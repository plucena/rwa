/**
 * COTI-native tests for the ported PrivateToken.
 *
 * The upstream suites (`private-token-transfer.tests.ts`, `private-token-max-balance-compliance.tests.ts`)
 * are gated on RUN_MPC_SEPOLIA_TESTS and reach their bubble proxy for key material and
 * decryption. This file replaces that transport with local crypto and targets the paths the
 * workplan flagged as unverified after B6 — above all the `checkedSubWithOverflowBit`
 * polarity, which burn, freeze and unfreeze all depend on and none of which had executed.
 *
 *   npx hardhat test test/token/private-token-coti.tests.ts \
 *     --config hardhat.private.config.ts --network coti-testnet
 */
import { expect } from 'chai';
import hre from 'hardhat';
import { buildItUint256, decryptUint256, privateKeyFor, selectorOf, userAesKey } from './helpers/cotiCrypto';

const ONE = 10n ** 8n; // 8 decimals, matching the deployed token
const GAS = { gasLimit: 8_000_000 };

describe('PrivateToken on COTI', function () {
  this.timeout(600_000);

  let token: any;
  let compliance: any;
  let registry: any;
  let alice: any; // primary signer; owns the AES key
  let bob: any;
  let key: string;

  /** Both parties' ciphertexts are encrypted to Alice's key so one key can read both. */
  async function balanceOf(who: string): Promise<bigint> {
    return decryptUint256(await token.balanceOf(who), key);
  }

  async function transfer(from: any, to: string, amount: bigint) {
    const it = await buildItUint256({
      value: amount,
      senderAddress: from.address,
      privateKey: privateKeyFor(from.address),
      contractAddress: token.address,
      functionSelector: selectorOf(token, 'transfer(address,((uint256,uint256),bytes))'),
      aesKeyHex: key,
    });
    return (await token.connect(from).transfer(to, it, GAS)).wait();
  }

  before(async function () {
    const { ethers } = hre as any;
    key = userAesKey();
    [alice, bob] = await ethers.getSigners();
    expect(bob, 'PRIVATE_KEY2 must be set for transfer tests').to.not.equal(undefined);

    registry = await (await ethers.getContractFactory('MockPrivateIdentityRegistry')).deploy();
    await registry.deployed();
    compliance = await (await ethers.getContractFactory('MaxBalancePrivateCompliance')).deploy();
    await compliance.deployed();
    token = await (await ethers.getContractFactory('PrivateToken')).deploy();
    await token.deployed();

    await (await token.init(
      registry.address, compliance.address, 'COTI Test pTREX', 'pTREX', 8,
      ethers.constants.AddressZero,
    )).wait();
    await (await compliance.bindToken(token.address)).wait();
    await (await token.addAgent(alice.address)).wait();
    await (await registry.setVerified(alice.address, true)).wait();
    await (await registry.setVerified(bob.address, true)).wait();
    await (await token.unpause()).wait();

    // Route Bob's ciphertexts to Alice's key. This is the B2 repair path doing real work:
    // without a second onboarded AES key, it is what makes Bob's balance readable in tests.
    await (await token.connect(bob).setAccountEncryptionAddress(alice.address, GAS)).wait();
  });

  describe('mint', () => {
    it('credits an encrypted balance the holder can decrypt, and reconciles public supply', async () => {
      await (await token.mint(alice.address, 1000n * ONE, GAS)).wait();
      expect(await balanceOf(alice.address)).to.equal(1000n * ONE);
      expect((await token.totalSupply()).toString()).to.equal((1000n * ONE).toString());
    });
  });

  describe('transfer', () => {
    it('moves the amount and leaves both balances correct', async () => {
      const before = { a: await balanceOf(alice.address), b: await balanceOf(bob.address) };
      await transfer(alice, bob.address, 250n * ONE);
      expect(await balanceOf(alice.address)).to.equal(before.a - 250n * ONE);
      expect(await balanceOf(bob.address)).to.equal(before.b + 250n * ONE);
    });

    it('emits one ciphertext per party, each readable by that party', async () => {
      const rc = await transfer(alice, bob.address, 10n * ONE);
      const ev = rc.events.find((e: any) => e.event === 'Transfer');
      expect(ev, 'Transfer event').to.not.equal(undefined);
      expect(decryptUint256(ev.args._fromValue, key)).to.equal(10n * ONE);
      expect(decryptUint256(ev.args._toValue, key)).to.equal(10n * ONE);
    });

    it('does NOT revert when the recipient is unverified — it moves zero', async () => {
      const { ethers } = hre as any;
      const stranger = ethers.Wallet.createRandom().address;
      const before = await balanceOf(alice.address);

      // The defining semantic of this port: a blocked transfer is indistinguishable
      // on-chain from a successful one, because reverting would leak the rule outcome.
      const rc = await transfer(alice, stranger, 5n * ONE);
      expect(rc.status).to.equal(1);
      expect(await balanceOf(alice.address)).to.equal(before);
    });

    it('moves zero when the amount exceeds the balance', async () => {
      const before = await balanceOf(bob.address);
      await transfer(bob, alice.address, before + 1n);
      expect(await balanceOf(bob.address)).to.equal(before);
    });
  });

  describe('partial freeze — pins the checkedSubWithOverflowBit polarity', () => {
    it('freezes an amount and reports it back to the holder', async () => {
      const it = await buildItUint256({
        value: 100n * ONE,
        senderAddress: alice.address,
        privateKey: privateKeyFor(alice.address),
        contractAddress: token.address,
        functionSelector: selectorOf(token, 'freezePartialTokens(address,((uint256,uint256),bytes))'),
        aesKeyHex: key,
      });
      await (await token.freezePartialTokens(alice.address, it, GAS)).wait();
      expect(decryptUint256(await token.getFrozenTokens(alice.address), key)).to.equal(100n * ONE);
    });

    it('blocks a transfer that would dip into the frozen portion', async () => {
      const bal = await balanceOf(alice.address);
      const before = await balanceOf(bob.address);
      // Free balance is (bal - 100). Asking for (bal - 50) must move nothing.
      await transfer(alice, bob.address, bal - 50n * ONE);
      expect(await balanceOf(alice.address)).to.equal(bal);
      expect(await balanceOf(bob.address)).to.equal(before);
    });

    it('allows a transfer strictly inside the free balance', async () => {
      const before = await balanceOf(bob.address);
      await transfer(alice, bob.address, 1n * ONE);
      expect(await balanceOf(bob.address)).to.equal(before + 1n * ONE);
    });

    it('unfreezes and restores transferability', async () => {
      const it = await buildItUint256({
        value: 100n * ONE,
        senderAddress: alice.address,
        privateKey: privateKeyFor(alice.address),
        contractAddress: token.address,
        functionSelector: selectorOf(token, 'unfreezePartialTokens(address,((uint256,uint256),bytes))'),
        aesKeyHex: key,
      });
      await (await token.unfreezePartialTokens(alice.address, it, GAS)).wait();
      expect(decryptUint256(await token.getFrozenTokens(alice.address), key)).to.equal(0n);
    });
  });

  describe('reencryptFrozenTokens — the on-demand reader path from B2', () => {
    it('gives an entitled agent its own readable copy', async () => {
      await (await token.reencryptFrozenTokens(alice.address, GAS)).wait();
      const copy = await token.frozenTokensFor(alice.address, alice.address);
      expect(decryptUint256(copy, key)).to.equal(0n);
    });

    it('refuses a caller who is neither the holder nor an agent', async () => {
      // Asserts failure rather than the reason string: COTI testnet does not return revert
      // data through this RPC, so `revertedWith` cannot see 'not entitled to this value'
      // and misreports the transaction as succeeding. The revert itself is real — the tx
      // lands with status 0.
      let reverted = false;
      try {
        await (await token.connect(bob).reencryptFrozenTokens(alice.address, GAS)).wait();
      } catch {
        reverted = true;
      }
      expect(reverted, 'unauthorised reencrypt must revert').to.equal(true);
    });
  });

  describe('burn', () => {
    it('burns and reconciles the public supply', async () => {
      const before = await balanceOf(alice.address);
      const supply = BigInt((await token.totalSupply()).toString());
      await (await token.burn(alice.address, 5n * ONE, GAS)).wait();
      expect(await balanceOf(alice.address)).to.equal(before - 5n * ONE);
      expect((await token.totalSupply()).toString()).to.equal((supply - 5n * ONE).toString());
    });
  });
});
