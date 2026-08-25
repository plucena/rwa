/**
 * Private Token — MaxBalance compliance.
 *
 * A rewrite of Soda Labs' suite of the same name against COTI, preserving its four intents.
 * `MaxBalancePrivateCompliance` keeps an encrypted per-holder shadow ledger and answers
 * `canTransfer` without revealing the amount or the running total — the dual-ledger problem
 * solved under encryption, and the reason ERC-3643 is the hard standard to make confidential.
 *
 *   npx hardhat test test/token/private-token-max-balance-compliance.tests.ts \
 *     --config hardhat.private.config.ts --network coti-testnet
 */
import { expect } from 'chai';
import hre from 'hardhat';
import {
  buildItUint256,
  decryptUint256,
  onboardAccount,
  privateKeyFor,
  selectorOf,
} from './helpers/cotiCrypto';

const ONE = 10n ** 8n;
const GAS = { gasLimit: 8_000_000 };
const TRANSFER_SIG = 'transfer(address,((uint256,uint256),bytes))';

describe('Private Token - MaxBalance compliance', function () {
  this.timeout(1_800_000);

  let token: any;
  let registry: any;
  let compliance: any;
  let agent: any;
  let recipient: any;
  const keyOf: Record<string, string> = {};

  const key = (a: string) => keyOf[a.toLowerCase()];
  const bal = async (a: string) => decryptUint256(await token.balanceOf(a), key(a));
  const supply = async () => BigInt((await token.totalSupply()).toString());

  const transfer = async (from: any, to: string, value: bigint) => {
    const it = await buildItUint256({
      value,
      senderAddress: from.address,
      privateKey: privateKeyFor(from.address),
      contractAddress: token.address,
      functionSelector: selectorOf(token, TRANSFER_SIG),
      aesKeyHex: key(from.address),
    });
    return (await token.connect(from).transfer(to, it, GAS)).wait();
  };

  async function deploySuite() {
    const { ethers } = hre as any;
    registry = await (await ethers.getContractFactory('MockPrivateIdentityRegistry')).deploy();
    await registry.deployed();
    compliance = await (await ethers.getContractFactory('MaxBalancePrivateCompliance')).deploy();
    await compliance.deployed();
    token = await (await ethers.getContractFactory('PrivateToken')).deploy();
    await token.deployed();

    await (await token.init(
      registry.address, compliance.address, 'Private TREX', 'pTREX', 8,
      ethers.constants.AddressZero,
    )).wait();
    await (await compliance.bindToken(token.address)).wait();
    await (await token.addAgent(agent.address)).wait();
    await (await registry.setVerified(agent.address, true)).wait();
    await (await registry.setVerified(recipient.address, true)).wait();
    await (await token.unpause()).wait();
  }

  before(async function () {
    const { ethers } = hre as any;
    [agent, recipient] = await ethers.getSigners();
    const onboard = await (await ethers.getContractFactory('AccountOnboard')).deploy();
    await onboard.deployed();
    keyOf[agent.address.toLowerCase()] = await onboardAccount(agent, onboard);
    keyOf[recipient.address.toLowerCase()] = await onboardAccount(recipient, onboard);
  });

  beforeEach(async () => { await deploySuite(); });

  it('enforces max balance on mint', async () => {
    await (await compliance.setMaxBalance(agent.address, 100n * ONE)).wait();

    await (await token.mint(agent.address, 60n * ONE, GAS)).wait();
    expect(await bal(agent.address)).to.equal(60n * ONE);

    // Would take the holder to 160, past the 100 cap: the mint must have no effect,
    // and the public supply must not move either.
    await (await token.mint(agent.address, 100n * ONE, GAS)).wait();
    expect(await bal(agent.address)).to.equal(60n * ONE);
    expect(await supply()).to.equal(60n * ONE);
  });

  it('supports private transfer flow with custom compliance bound', async () => {
    await (await compliance.setMaxBalance(recipient.address, 1000n * ONE)).wait();
    await (await token.mint(agent.address, 500n * ONE, GAS)).wait();

    await transfer(agent, recipient.address, 200n * ONE);

    expect(await bal(agent.address)).to.equal(300n * ONE);
    expect(await bal(recipient.address)).to.equal(200n * ONE);
  });

  it('blocks private transfer that would exceed recipient max balance', async () => {
    await (await compliance.setMaxBalance(recipient.address, 150n * ONE)).wait();
    await (await token.mint(agent.address, 500n * ONE, GAS)).wait();

    await transfer(agent, recipient.address, 200n * ONE);

    // Blocked transfers move an encrypted zero rather than reverting, because a revert
    // would disclose which rule failed — here, the recipient's position against a public cap.
    expect(await bal(recipient.address)).to.equal(0n);
    expect(await bal(agent.address)).to.equal(500n * ONE);
  });

  it('tracks cumulative transfers against max balance', async () => {
    await (await compliance.setMaxBalance(recipient.address, 250n * ONE)).wait();
    await (await token.mint(agent.address, 500n * ONE, GAS)).wait();

    await transfer(agent, recipient.address, 100n * ONE);
    await transfer(agent, recipient.address, 100n * ONE);
    expect(await bal(recipient.address)).to.equal(200n * ONE);

    // Third transfer would reach 300, past the 250 cap — the shadow ledger must remember
    // the earlier two even though every amount involved is encrypted.
    await transfer(agent, recipient.address, 100n * ONE);
    expect(await bal(recipient.address)).to.equal(200n * ONE);
  });
});
