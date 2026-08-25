/**
 * Coverage for the paths left open after the first COTI suite: allowances and
 * `transferFrom`, batch operations, and `recoveryAddress`.
 *
 * Also documents a port defect the ABI makes visible: the entry points taking `gtUint256`
 * are **not callable from outside on COTI**, because a garbled handle is transient within a
 * transaction and cannot be produced by a caller. See the final describe block.
 *
 *   npx hardhat test test/token/private-token-coti-allowances.tests.ts \
 *     --config hardhat.private.config.ts --network coti-testnet
 */
import { expect } from 'chai';
import hre from 'hardhat';
import { buildItUint256, decryptUint256, onboardAccount, privateKeyFor, selectorOf } from './helpers/cotiCrypto';

const ONE = 10n ** 8n;
const GAS = { gasLimit: 8_000_000 };

describe('PrivateToken on COTI — allowances, batch, recovery', function () {
  this.timeout(900_000);

  let token: any;
  let registry: any;
  let alice: any;
  let bob: any;
  let keyOf: Record<string, string> = {};

  /** Each holder reads their own ciphertext with their own onboarded key. */
  const bal = async (who: string) => decryptUint256(await token.balanceOf(who), keyOf[who.toLowerCase()]);

  /** Inputs are encrypted under the *sender's* key — that is the whole point of onboarding. */
  async function it256(signer: any, sig: string, value: bigint) {
    return buildItUint256({
      value,
      senderAddress: signer.address,
      privateKey: privateKeyFor(signer.address),
      contractAddress: token.address,
      functionSelector: selectorOf(token, sig),
      aesKeyHex: keyOf[signer.address.toLowerCase()],
    });
  }

  before(async () => {
    const { ethers } = hre as any;
    [alice, bob] = await ethers.getSigners();

    // Onboard both signers so each holds its own AES key. Without this, inputs signed by
    // one account but encrypted under another's key decrypt to garbage and the transfer
    // silently moves zero — which makes negative tests pass for the wrong reason.
    const onboard = await (await ethers.getContractFactory('AccountOnboard')).deploy();
    await onboard.deployed();
    keyOf[alice.address.toLowerCase()] = await onboardAccount(alice, onboard);
    keyOf[bob.address.toLowerCase()] = await onboardAccount(bob, onboard);

    registry = await (await ethers.getContractFactory('MockPrivateIdentityRegistry')).deploy();
    await registry.deployed();
    const compliance = await (await ethers.getContractFactory('MaxBalancePrivateCompliance')).deploy();
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
    await (await token.mint(alice.address, 1000n * ONE, GAS)).wait();
  });

  describe('allowances — the other three-party value from B2', () => {
    it('approve writes a copy each for owner and spender', async () => {
      const it = await it256(alice, 'approve(address,((uint256,uint256),bytes))', 300n * ONE);
      const rc = await (await token.approve(bob.address, it, GAS)).wait();

      // Each party decrypts its own copy with its own key — the three-ciphertext design
      // from B2, verified end to end rather than through a shared-key shortcut.
      const ev = rc.events.find((e: any) => e.event === 'Approval');
      expect(ev, 'Approval event').to.not.equal(undefined);
      expect(decryptUint256(ev.args._ownerValue, keyOf[alice.address.toLowerCase()])).to.equal(300n * ONE);
      expect(decryptUint256(ev.args._spenderValue, keyOf[bob.address.toLowerCase()])).to.equal(300n * ONE);
    });

    it('increaseAllowance and decreaseAllowance move the encrypted total', async () => {
      await (await token.increaseAllowance(
        bob.address, await it256(alice, 'increaseAllowance(address,((uint256,uint256),bytes))', 50n * ONE), GAS,
      )).wait();
      expect(decryptUint256(await token.allowance(alice.address, bob.address), keyOf[alice.address.toLowerCase()]))
        .to.equal(350n * ONE);

      await (await token.decreaseAllowance(
        bob.address, await it256(alice, 'decreaseAllowance(address,((uint256,uint256),bytes))', 100n * ONE), GAS,
      )).wait();
      expect(decryptUint256(await token.allowance(alice.address, bob.address), keyOf[alice.address.toLowerCase()]))
        .to.equal(250n * ONE);
    });

    it('transferFrom lets a distinct spender move the owner\'s tokens', async () => {
      const beforeA = await bal(alice.address);
      const beforeB = await bal(bob.address);

      // Bob signs and encrypts with Bob's own key — a genuine third party, not the owner.
      const it = await it256(bob, 'transferFrom(address,address,((uint256,uint256),bytes))', 200n * ONE);
      await (await token.connect(bob).transferFrom(alice.address, bob.address, it, GAS)).wait();

      expect(await bal(alice.address)).to.equal(beforeA - 200n * ONE);
      expect(await bal(bob.address)).to.equal(beforeB + 200n * ONE);
      expect(decryptUint256(await token.allowance(alice.address, bob.address), keyOf[alice.address.toLowerCase()]))
        .to.equal(50n * ONE);
    });

    it('moves zero and leaves allowance intact when the allowance is insufficient', async () => {
      const beforeA = await bal(alice.address);
      const owner = keyOf[alice.address.toLowerCase()];
      const allowanceBefore = decryptUint256(await token.allowance(alice.address, bob.address), owner);

      const it = await it256(bob, 'transferFrom(address,address,((uint256,uint256),bytes))', allowanceBefore + 1n);
      await (await token.connect(bob).transferFrom(alice.address, bob.address, it, GAS)).wait();

      expect(await bal(alice.address)).to.equal(beforeA);
      expect(decryptUint256(await token.allowance(alice.address, bob.address), owner))
        .to.equal(allowanceBefore);
    });
  });

  describe('batch operations', () => {
    it('batchMint credits several holders and reconciles supply', async () => {
      const supply = BigInt((await token.totalSupply()).toString());
      const beforeA = await bal(alice.address);
      const beforeB = await bal(bob.address);

      await (await token.batchMint([alice.address, bob.address], [10n * ONE, 20n * ONE], GAS)).wait();

      expect(await bal(alice.address)).to.equal(beforeA + 10n * ONE);
      expect(await bal(bob.address)).to.equal(beforeB + 20n * ONE);
      expect((await token.totalSupply()).toString()).to.equal((supply + 30n * ONE).toString());
    });

    it('batchTransfer sends encrypted amounts to several recipients', async () => {
      const beforeB = await bal(bob.address);
      const its = [
        await it256(alice, 'batchTransfer(address[],((uint256,uint256),bytes)[])', 5n * ONE),
        await it256(alice, 'batchTransfer(address[],((uint256,uint256),bytes)[])', 7n * ONE),
      ];
      await (await token.batchTransfer([bob.address, bob.address], its, GAS)).wait();
      expect(await bal(bob.address)).to.equal(beforeB + 12n * ONE);
    });

    it('batchBurn reduces balances and public supply together', async () => {
      const supply = BigInt((await token.totalSupply()).toString());
      const beforeA = await bal(alice.address);
      await (await token.batchBurn([alice.address], [3n * ONE], GAS)).wait();
      expect(await bal(alice.address)).to.equal(beforeA - 3n * ONE);
      expect((await token.totalSupply()).toString()).to.equal((supply - 3n * ONE).toString());
    });

    it('rejects a batchBurn over MAX_BATCH_BURN_SIZE', async () => {
      const max = Number(await token.MAX_BATCH_BURN_SIZE());
      const users = new Array(max + 1).fill(alice.address);
      const amounts = new Array(max + 1).fill(1n);
      let reverted = false;
      try {
        await (await token.batchBurn(users, amounts, GAS)).wait();
      } catch { reverted = true; }
      expect(reverted, 'oversized batchBurn must revert').to.equal(true);
    });
  });

  describe('recoveryAddress', () => {
    // Both wallets are onboarded, so the balance can be asserted on each side of the move.
    it('moves the whole balance from the lost wallet to the new one', async () => {
      const { ethers } = hre as any;
      const onchainId = await (await ethers.getContractFactory('MockPrivateIdentity')).deploy();
      await onchainId.deployed();

      // recoveryAddress only proceeds when the new wallet holds a management key (purpose 1)
      // on the investor's ONCHAINID. Without this the call reverts, which is correct
      // behaviour and was a gap in the test rather than in the contract.
      const managementKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['address'], [alice.address]),
      );
      await (await onchainId.setKeyPurpose(managementKey, 1, true)).wait();

      const lostBalance = await bal(bob.address);
      const aliceBefore = await bal(alice.address);
      expect(lostBalance).to.be.greaterThan(0n);

      await (await token.recoveryAddress(bob.address, alice.address, onchainId.address, GAS)).wait();

      expect(await bal(bob.address)).to.equal(0n);
      expect(await bal(alice.address)).to.equal(aliceBefore + lostBalance);
    });
  });

  /**
   * These entry points take `gtUint256`, which on Soda's bubble was a durable handle a caller
   * could hold and pass back. COTI garbled values live only inside the transaction that made
   * them, so no external caller can produce one. The functions are therefore dead on COTI and
   * need `itUint256` parameters — a port defect, not a test gap.
   */
  describe('gtUint256 entry points are uncallable on COTI (documented defect)', () => {
    it('forcedTransfer cannot be driven from outside', async () => {
      let failed = false;
      try {
        await (await token.forcedTransfer(alice.address, bob.address, 1n * ONE, GAS)).wait();
      } catch { failed = true; }
      expect(failed, 'a raw uint256 is not a valid gt handle on COTI').to.equal(true);
    });

    it('batchFreezePartialTokens cannot be driven from outside', async () => {
      let failed = false;
      try {
        await (await token.batchFreezePartialTokens([alice.address], [1n * ONE], GAS)).wait();
      } catch { failed = true; }
      expect(failed, 'a raw uint256 is not a valid gt handle on COTI').to.equal(true);
    });
  });
});
