/**
 * Private Token — transfers, allowances, freezing, mint/burn and batch operations.
 *
 * A rewrite of the upstream suite of the same name against COTI. Theirs could not simply be
 * repointed: it was written for a storage model this port removed. Upstream held durable
 * `gtUint256` handles in storage and decrypted a handle through their bubble proxy, whereas
 * COTI garbled values do not survive a transaction, so storage holds `ctUint256` decrypted
 * locally. Their inputs also carried no function selector, which COTI binds into the signature.
 *
 * Test intent is preserved one-for-one. Where a behaviour is unreachable on COTI that is
 * asserted explicitly rather than dropped — see the final block.
 *
 *   npx hardhat test test/token/private-token-transfer.tests.ts \
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

const SIG = {
  transfer: 'transfer(address,((uint256,uint256),bytes))',
  approve: 'approve(address,((uint256,uint256),bytes))',
  increaseAllowance: 'increaseAllowance(address,((uint256,uint256),bytes))',
  decreaseAllowance: 'decreaseAllowance(address,((uint256,uint256),bytes))',
  transferFrom: 'transferFrom(address,address,((uint256,uint256),bytes))',
  freeze: 'freezePartialTokens(address,((uint256,uint256),bytes))',
  unfreeze: 'unfreezePartialTokens(address,((uint256,uint256),bytes))',
  batchTransfer: 'batchTransfer(address[],((uint256,uint256),bytes)[])',
};

describe('Private Token - Transfers', function () {
  this.timeout(1_800_000);

  let token: any;
  let registry: any;
  let compliance: any;
  let agent: any;
  let holder: any;
  const keyOf: Record<string, string> = {};

  const key = (a: string) => keyOf[a.toLowerCase()];
  const bal = async (a: string) => decryptUint256(await token.balanceOf(a), key(a));
  const frozen = async (a: string) => decryptUint256(await token.getFrozenTokens(a), key(a));
  const supply = async () => BigInt((await token.totalSupply()).toString());

  const it256 = (signer: any, sig: string, value: bigint) =>
    buildItUint256({
      value,
      senderAddress: signer.address,
      privateKey: privateKeyFor(signer.address),
      contractAddress: token.address,
      functionSelector: selectorOf(token, sig),
      aesKeyHex: key(signer.address),
    });

  /** Fresh suite per describe-block so balances start from a known state. */
  async function deploySuite(complianceName = 'MaxBalancePrivateCompliance') {
    const { ethers } = hre as any;
    registry = await (await ethers.getContractFactory('MockPrivateIdentityRegistry')).deploy();
    await registry.deployed();
    compliance = await (await ethers.getContractFactory(complianceName)).deploy();
    await compliance.deployed();
    token = await (await ethers.getContractFactory('PrivateToken')).deploy();
    await token.deployed();

    await (await token.init(
      registry.address, compliance.address, 'Private TREX', 'pTREX', 8,
      ethers.constants.AddressZero,
    )).wait();
    // `token.init` already binds the compliance contract via `setCompliance`. Calling
    // `bindToken` again here breaks on the mocks, whose implementation is `pure` and so is
    // dispatched by ethers as a call rather than a transaction.
    await (await token.addAgent(agent.address)).wait();
    await (await registry.setVerified(agent.address, true)).wait();
    await (await registry.setVerified(holder.address, true)).wait();
    await (await token.unpause()).wait();
  }

  before(async function () {
    const { ethers } = hre as any;
    [agent, holder] = await ethers.getSigners();
    // Each signer needs its own AES key: an input must be encrypted under the sender's key,
    // and a wrong key decrypts to garbage rather than reverting, which would let negative
    // assertions pass for the wrong reason.
    const onboard = await (await ethers.getContractFactory('AccountOnboard')).deploy();
    await onboard.deployed();
    keyOf[agent.address.toLowerCase()] = await onboardAccount(agent, onboard);
    keyOf[holder.address.toLowerCase()] = await onboardAccount(holder, onboard);
  });

  describe('mint', () => {
    before(async () => { await deploySuite(); });

    it('should mint and match decrypted balance', async () => {
      await (await token.mint(agent.address, 1000n * ONE, GAS)).wait();
      expect(await bal(agent.address)).to.equal(1000n * ONE);
      expect(await supply()).to.equal(1000n * ONE);
    });

    it('should batchMint clear amounts to multiple recipients and decrypt balances', async () => {
      const before = { a: await bal(agent.address), h: await bal(holder.address) };
      await (await token.batchMint([agent.address, holder.address], [10n * ONE, 20n * ONE], GAS)).wait();
      expect(await bal(agent.address)).to.equal(before.a + 10n * ONE);
      expect(await bal(holder.address)).to.equal(before.h + 20n * ONE);
    });
  });

  describe('mint under compliance', () => {
    it('follows ERC-3643 compliance semantics for mint: true allows', async () => {
      await deploySuite('MockPrivateCompliance'); // canTransfer -> true
      await (await token.mint(agent.address, 100n * ONE, GAS)).wait();
      expect(await bal(agent.address)).to.equal(100n * ONE);
      expect(await supply()).to.equal(100n * ONE);
    });

    it('does not increase totalSupply when compliance blocks mint', async () => {
      await deploySuite('MockPrivateComplianceFalse'); // canTransfer -> false
      await (await token.mint(agent.address, 100n * ONE, GAS)).wait();
      expect(await bal(agent.address)).to.equal(0n);
      expect(await supply()).to.equal(0n);
    });
  });

  describe('allowances', () => {
    before(async () => {
      await deploySuite();
      await (await token.mint(agent.address, 1000n * ONE, GAS)).wait();
    });

    it('should approve encrypted amount and let owner decrypt allowance', async () => {
      await (await token.approve(holder.address, await it256(agent, SIG.approve, 300n * ONE), GAS)).wait();
      expect(decryptUint256(await token.allowance(agent.address, holder.address), key(agent.address)))
        .to.equal(300n * ONE);
    });

    it('should increaseAllowance with encrypted amount and let owner decrypt updated allowance', async () => {
      await (await token.increaseAllowance(holder.address, await it256(agent, SIG.increaseAllowance, 50n * ONE), GAS)).wait();
      expect(decryptUint256(await token.allowance(agent.address, holder.address), key(agent.address)))
        .to.equal(350n * ONE);
    });

    it('should decreaseAllowance with encrypted amount and let owner decrypt updated allowance', async () => {
      await (await token.decreaseAllowance(holder.address, await it256(agent, SIG.decreaseAllowance, 100n * ONE), GAS)).wait();
      expect(decryptUint256(await token.allowance(agent.address, holder.address), key(agent.address)))
        .to.equal(250n * ONE);
    });

    it('should transferFrom with encrypted amount and update allowance', async () => {
      const before = { a: await bal(agent.address), h: await bal(holder.address) };
      await (await token.connect(holder).transferFrom(
        agent.address, holder.address, await it256(holder, SIG.transferFrom, 200n * ONE), GAS,
      )).wait();
      expect(await bal(agent.address)).to.equal(before.a - 200n * ONE);
      expect(await bal(holder.address)).to.equal(before.h + 200n * ONE);
      expect(decryptUint256(await token.allowance(agent.address, holder.address), key(agent.address)))
        .to.equal(50n * ONE);
    });

    it('keeps transferFrom amount zero and allowance unchanged when allowance is insufficient', async () => {
      const before = await bal(agent.address);
      const allowanceBefore = decryptUint256(await token.allowance(agent.address, holder.address), key(agent.address));
      await (await token.connect(holder).transferFrom(
        agent.address, holder.address, await it256(holder, SIG.transferFrom, allowanceBefore + 1n), GAS,
      )).wait();
      expect(await bal(agent.address)).to.equal(before);
      expect(decryptUint256(await token.allowance(agent.address, holder.address), key(agent.address)))
        .to.equal(allowanceBefore);
    });
  });

  describe('transfers', () => {
    before(async () => {
      await deploySuite();
      await (await token.mint(agent.address, 1000n * ONE, GAS)).wait();
    });

    it('should transfer minted private balance to another user', async () => {
      const before = await bal(holder.address);
      await (await token.transfer(holder.address, await it256(agent, SIG.transfer, 100n * ONE), GAS)).wait();
      expect(await bal(holder.address)).to.equal(before + 100n * ONE);
    });

    it('should batchTransfer encrypted amounts to multiple recipients', async () => {
      const before = await bal(holder.address);
      const its = [
        await it256(agent, SIG.batchTransfer, 5n * ONE),
        await it256(agent, SIG.batchTransfer, 7n * ONE),
      ];
      await (await token.batchTransfer([holder.address, holder.address], its, GAS)).wait();
      expect(await bal(holder.address)).to.equal(before + 12n * ONE);
    });
  });

  describe('free balance and the freeze boundary', () => {
    beforeEach(async () => {
      await deploySuite();
      await (await token.mint(agent.address, 1000n * ONE, GAS)).wait();
      await (await token.freezePartialTokens(agent.address, await it256(agent, SIG.freeze, 400n * ONE), GAS)).wait();
    });

    it('should block transfer above free balance (balance - frozen)', async () => {
      const before = await bal(holder.address);
      await (await token.transfer(holder.address, await it256(agent, SIG.transfer, 700n * ONE), GAS)).wait();
      expect(await bal(holder.address)).to.equal(before);
      expect(await bal(agent.address)).to.equal(1000n * ONE);
    });

    it('applies free-balance policy at the boundary: equal passes', async () => {
      // Free balance is exactly 600. An off-by-one in an encrypted comparison hides here.
      await (await token.transfer(holder.address, await it256(agent, SIG.transfer, 600n * ONE), GAS)).wait();
      expect(await bal(agent.address)).to.equal(400n * ONE);
    });

    it('applies free-balance policy at the boundary: one above blocks', async () => {
      await (await token.transfer(holder.address, await it256(agent, SIG.transfer, 600n * ONE + 1n), GAS)).wait();
      expect(await bal(agent.address)).to.equal(1000n * ONE);
    });
  });

  describe('freeze and unfreeze', () => {
    before(async () => {
      await deploySuite();
      await (await token.mint(agent.address, 1000n * ONE, GAS)).wait();
    });

    it('should freeze partial tokens and let agent decrypt event + getFrozenTokens', async () => {
      const rc = await (await token.freezePartialTokens(agent.address, await it256(agent, SIG.freeze, 100n * ONE), GAS)).wait();
      const ev = rc.events.find((e: any) => e.event === 'TokensFrozen');
      expect(ev, 'TokensFrozen event').to.not.equal(undefined);
      expect(decryptUint256(ev.args._amount, key(agent.address))).to.equal(100n * ONE);
      expect(await frozen(agent.address)).to.equal(100n * ONE);
    });

    it('should not freeze when requested amount exceeds balance', async () => {
      const before = await frozen(agent.address);
      await (await token.freezePartialTokens(agent.address, await it256(agent, SIG.freeze, 10_000n * ONE), GAS)).wait();
      expect(await frozen(agent.address)).to.equal(before);
    });

    it('should unfreeze partial tokens and let agent decrypt event + getFrozenTokens', async () => {
      const rc = await (await token.unfreezePartialTokens(agent.address, await it256(agent, SIG.unfreeze, 40n * ONE), GAS)).wait();
      const ev = rc.events.find((e: any) => e.event === 'TokensUnfrozen');
      expect(ev, 'TokensUnfrozen event').to.not.equal(undefined);
      expect(decryptUint256(ev.args._amount, key(agent.address))).to.equal(40n * ONE);
      expect(await frozen(agent.address)).to.equal(60n * ONE);
    });

    it('should not unfreeze when requested amount exceeds frozen tokens', async () => {
      const before = await frozen(agent.address);
      await (await token.unfreezePartialTokens(agent.address, await it256(agent, SIG.unfreeze, 10_000n * ONE), GAS)).wait();
      expect(await frozen(agent.address)).to.equal(before);
    });
  });

  describe('burn', () => {
    beforeEach(async () => {
      await deploySuite();
      await (await token.mint(agent.address, 1000n * ONE, GAS)).wait();
    });

    it('should burn and update totalSupply by the decrypted burned amount', async () => {
      await (await token.burn(agent.address, 300n * ONE, GAS)).wait();
      expect(await bal(agent.address)).to.equal(700n * ONE);
      expect(await supply()).to.equal(700n * ONE);
    });

    it('keeps effective burn at zero when requested burn exceeds private balance', async () => {
      // `burn` first checks the request against *public* total supply and reverts if it
      // exceeds it, so the amount has to stay under supply while still exceeding this
      // holder's private balance. Minting to a second holder creates that gap.
      await (await token.mint(holder.address, 4000n * ONE, GAS)).wait();
      const supplyBefore = await supply();

      await (await token.burn(agent.address, 1500n * ONE, GAS)).wait();

      expect(await bal(agent.address)).to.equal(1000n * ONE);
      expect(await supply()).to.equal(supplyBefore);
    });

    it('should burn above free balance and unfreeze the required delta', async () => {
      await (await token.freezePartialTokens(agent.address, await it256(agent, SIG.freeze, 800n * ONE), GAS)).wait();
      // Free balance is 200; burning 500 must consume 300 of the frozen portion.
      await (await token.burn(agent.address, 500n * ONE, GAS)).wait();
      expect(await bal(agent.address)).to.equal(500n * ONE);
      expect(await frozen(agent.address)).to.equal(500n * ONE);
    });

    it('should batchBurn clear amounts and update totalSupply', async () => {
      await (await token.batchBurn([agent.address], [3n * ONE], GAS)).wait();
      expect(await bal(agent.address)).to.equal(997n * ONE);
      expect(await supply()).to.equal(997n * ONE);
    });

    it('reverts when batchBurn length exceeds MAX_BATCH_BURN_SIZE', async () => {
      const max = Number(await token.MAX_BATCH_BURN_SIZE());
      let reverted = false;
      try {
        await (await token.batchBurn(
          new Array(max + 1).fill(agent.address), new Array(max + 1).fill(1n), GAS,
        )).wait();
      } catch { reverted = true; }
      expect(reverted).to.equal(true);
    });

    it('exposes pending-burn views for unused decrypt ids', async () => {
      // Decryption resolves inside the transaction on COTI, so nothing is ever left pending.
      expect(await token.isBurnDecryptPending(999_999)).to.equal(false);
      expect(await token.getPendingBatchBurnUsers(999_999)).to.deep.equal([]);
      expect(await token.getPendingSingleBurnUser(999_999))
        .to.equal('0x0000000000000000000000000000000000000000');
    });
  });

  describe('recovery', () => {
    it('should recover address and preserve frozen state', async () => {
      const { ethers } = hre as any;
      await deploySuite();
      await (await token.mint(holder.address, 500n * ONE, GAS)).wait();
      await (await token.freezePartialTokens(holder.address, await it256(agent, SIG.freeze, 120n * ONE), GAS)).wait();

      const onchainId = await (await ethers.getContractFactory('MockPrivateIdentity')).deploy();
      await onchainId.deployed();
      const managementKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['address'], [agent.address]),
      );
      await (await onchainId.setKeyPurpose(managementKey, 1, true)).wait();

      const before = await bal(holder.address);
      const frozenBefore = await frozen(holder.address);
      expect(frozenBefore).to.equal(120n * ONE);

      await (await token.recoveryAddress(holder.address, agent.address, onchainId.address, GAS)).wait();

      expect(await bal(holder.address)).to.equal(0n);
      expect(await bal(agent.address)).to.equal(before);
      expect(await frozen(agent.address)).to.equal(frozenBefore);
    });
  });

  describe('batch guards (reachable — they revert before any MPC work)', () => {
    before(async () => { await deploySuite(); });

    const expectRevert = async (p: Promise<any>) => {
      let reverted = false;
      try { await (await p).wait(); } catch { reverted = true; }
      expect(reverted).to.equal(true);
    };

    it('reverts batchFreezePartialTokens when user and amount lengths mismatch', async () =>
      expectRevert(token.batchFreezePartialTokens([agent.address, holder.address], [1n], GAS)));

    it('reverts batchFreezePartialTokens when caller is not an agent', async () =>
      expectRevert(token.connect(holder).batchFreezePartialTokens([agent.address], [1n], GAS)));

    it('reverts batchUnfreezePartialTokens when user and amount lengths mismatch', async () =>
      expectRevert(token.batchUnfreezePartialTokens([agent.address, holder.address], [1n], GAS)));

    it('reverts batchUnfreezePartialTokens when caller is not an agent', async () =>
      expectRevert(token.connect(holder).batchUnfreezePartialTokens([agent.address], [1n], GAS)));
  });

  /**
   * The upstream suite drives these with `gtUint256` handles held across transactions. COTI garbled
   * values exist only inside the transaction that created them, so no external caller can
   * produce one and these entry points are unreachable. They need `itUint256` parameters.
   * Asserted rather than deleted so the defect cannot be quietly forgotten.
   */
  describe('gtUint256 entry points are unreachable on COTI (port defect)', () => {
    before(async () => {
      await deploySuite();
      await (await token.mint(agent.address, 100n * ONE, GAS)).wait();
    });

    const expectUnreachable = async (p: Promise<any>) => {
      let failed = false;
      try { await (await p).wait(); } catch { failed = true; }
      expect(failed, 'a raw uint256 is not a valid gt handle on COTI').to.equal(true);
    };

    it('forcedTransfer cannot be driven from outside', async () =>
      expectUnreachable(token.forcedTransfer(agent.address, holder.address, 1n * ONE, GAS)));

    it('batchForcedTransfer cannot be driven from outside', async () =>
      expectUnreachable(token.batchForcedTransfer([agent.address], [holder.address], [1n * ONE], GAS)));

    it('batchFreezePartialTokens cannot be driven from outside', async () =>
      expectUnreachable(token.batchFreezePartialTokens([agent.address], [1n * ONE], GAS)));

    it('batchUnfreezePartialTokens cannot be driven from outside', async () =>
      expectUnreachable(token.batchUnfreezePartialTokens([agent.address], [1n * ONE], GAS)));
  });
});
