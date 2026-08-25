/**
 * COTI-native replacement for `bubbleCryptoTransport.ts`.
 *
 * The upstream tests reach an HTTP proxy on their bubble network to onboard a user key,
 * encrypt inputs and decrypt results. COTI needs none of that: the AES key is held by
 * the caller, encryption and decryption are local, and decryption inside a contract is
 * synchronous. This module is the whole transport layer, replaced by ~80 lines of crypto.
 *
 * Scheme (matches `coti-ethers` JsonRpcSigner#buildInputText and MpcCore's expectations):
 *   ct        = high.cipher || high.r || low.cipher || low.r      (64 bytes)
 *   cipher    = AES-ECB(key, r) XOR plaintextBlock                (r random, 16 bytes)
 *   msgHash   = keccak256(abi.encodePacked(sender, contract, selector, ct))
 *   signature = personal_sign(msgHash)
 */
import crypto from 'crypto';
import { utils } from 'ethers';

const BLOCK = 16;

function aesEcb(keyHex: string, block: Buffer): Buffer {
  const c = crypto.createCipheriv('aes-128-ecb', Buffer.from(keyHex, 'hex'), null);
  c.setAutoPadding(false);
  return Buffer.concat([c.update(block), c.final()]);
}

function xor(a: Buffer, b: Buffer): Buffer {
  return Buffer.from(a.map((v, i) => v ^ b[i]));
}

/** Encrypt one 16-byte block, returning `cipher || r` (32 bytes). */
function encryptBlock(keyHex: string, plain: Buffer): Buffer {
  const r = crypto.randomBytes(BLOCK);
  return Buffer.concat([xor(aesEcb(keyHex, r), plain), r]);
}

/** Inverse of {@link encryptBlock}: takes `cipher || r`, returns the 16-byte plaintext. */
function decryptBlock(keyHex: string, limb: Buffer): Buffer {
  return xor(aesEcb(keyHex, limb.subarray(16, 32)), limb.subarray(0, 16));
}

/** A 256-bit value as the two ciphertext limbs MpcCore expects, plus the raw 64-byte ct. */
export function encryptUint256(value: bigint, keyHex: string) {
  const plain = Buffer.from(value.toString(16).padStart(64, '0'), 'hex'); // 32 bytes
  const high = encryptBlock(keyHex, plain.subarray(0, BLOCK));
  const low = encryptBlock(keyHex, plain.subarray(BLOCK));
  const ct = Buffer.concat([high, low]);
  return {
    ct,
    ciphertextHigh: BigInt('0x' + high.toString('hex')),
    ciphertextLow: BigInt('0x' + low.toString('hex')),
  };
}

/**
 * Recover a 256-bit value from a stored `ctUint256 { ciphertextHigh, ciphertextLow }`.
 *
 * An all-zero ciphertext means the slot was never written — a holder who has never received
 * anything. It is not a ciphertext of zero, and decrypting it yields a deterministic garbage
 * value rather than 0. The contract makes the same distinction on-chain via `_isUnset`;
 * without it here, reading an untouched balance produces nonsense that looks like a
 * contract bug and is not one.
 */
export function decryptUint256(
  ct: { ciphertextHigh: { toString(): string }; ciphertextLow: { toString(): string } },
  keyHex: string,
): bigint {
  if (BigInt(ct.ciphertextHigh.toString()) === 0n && BigInt(ct.ciphertextLow.toString()) === 0n) {
    return 0n;
  }
  const limb = (v: { toString(): string }) =>
    Buffer.from(BigInt(v.toString()).toString(16).padStart(64, '0'), 'hex');
  const hi = decryptBlock(keyHex, limb(ct.ciphertextHigh));
  const lo = decryptBlock(keyHex, limb(ct.ciphertextLow));
  return (BigInt('0x' + hi.toString('hex')) << 128n) | BigInt('0x' + lo.toString('hex'));
}

/**
 * Build a signed `itUint256` for a specific contract *and function*.
 *
 * The selector is part of the signed message, so an input built for `transfer` cannot be
 * replayed against `approve`. This is the binding that made the upstream `isSenderPermitted`
 * check redundant — see the B2 notes in the workplan.
 *
 * NOTE the signature format, which is where this first went wrong: COTI's node SDK
 * (`signIT`) does a **raw ECDSA sign of the digest** and serialises `r || s || (v - 27)`.
 * It is not `personal_sign`, and `v` is 0/1 rather than 27/28. The browser path in
 * `coti-ethers` uses `signMessage` only because MetaMask cannot raw-sign.
 */
export async function buildItUint256(params: {
  value: bigint;
  senderAddress: string;
  privateKey: string;
  contractAddress: string;
  functionSelector: string; // e.g. '0x12345678'
  aesKeyHex: string;
}) {
  const { value, senderAddress, privateKey, contractAddress, functionSelector, aesKeyHex } = params;
  const { ct, ciphertextHigh, ciphertextLow } = encryptUint256(value, aesKeyHex);

  const msgHash = utils.solidityKeccak256(
    ['bytes', 'bytes', 'bytes4', 'bytes'],
    [senderAddress, contractAddress, functionSelector, ct],
  );

  const sig = new utils.SigningKey(privateKey).signDigest(msgHash);
  const signature = utils.hexlify(
    utils.concat([sig.r, sig.s, new Uint8Array([sig.recoveryParam])]),
  );

  return { ciphertext: { ciphertextHigh, ciphertextLow }, signature };
}

/** Private key for a signer address, read from the environment. */
export function privateKeyFor(address: string): string {
  const { computeAddress } = utils;
  for (const name of ['PRIVATE_KEY', 'PRIVATE_KEY2']) {
    const k = process.env[name];
    if (!k) continue;
    const pk = k.startsWith('0x') ? k : '0x' + k;
    if (computeAddress(pk).toLowerCase() === address.toLowerCase()) return pk;
  }
  throw new Error(`No private key in .env for ${address}`);
}

/** Selector for a function on an ethers v5 contract, e.g. `selectorOf(token, 'transfer(address,(...))')`. */
export function selectorOf(contract: any, signature: string): string {
  return contract.interface.getSighash(signature);
}

/** The holder's AES key. On COTI this is held by the caller, not fetched from a proxy. */
export function userAesKey(): string {
  const k = (process.env.PRIVATE_AES_KEY_TESTNET || '').replace(/^0x/, '');
  if (k.length !== 32) {
    throw new Error('PRIVATE_AES_KEY_TESTNET must be a 16-byte hex string (32 chars)');
  }
  return k;
}

// ---------------------------------------------------------------------------
//  Account onboarding — how a signer obtains its own AES key.
//
//  An encrypted input must be encrypted under the *sender's* key: the precompile
//  recovers the signer from the signature and looks that account's key up, and it
//  knows nothing about a contract's `_accountEncryptionAddress` mapping. Redirecting
//  outputs is therefore not enough for multi-party tests — without a real key per
//  account, an input built under the wrong key decrypts to garbage and the transfer
//  quietly moves zero, so a test asserting "nothing moved" passes for the wrong reason.
//
//  Mirrors `coti-ethers` utils/onboard.ts, implemented against node-forge directly
//  because @coti-io/coti-sdk-typescript is not a dependency of this tree.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-var-requires
const forge = require('node-forge');

function binaryStringToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/** A fresh 2048-bit RSA key pair in DER form, as `getUserKey` expects. */
export function generateRsaKeyPair(): { publicKey: Uint8Array; privateKey: Uint8Array } {
  const kp = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  return {
    publicKey: binaryStringToBytes(forge.asn1.toDer(forge.pki.publicKeyToAsn1(kp.publicKey)).data),
    privateKey: binaryStringToBytes(forge.asn1.toDer(forge.pki.privateKeyToAsn1(kp.privateKey)).data),
  };
}

/** RSA-OAEP(SHA-256) decrypt one key share, returning raw bytes. */
function decryptRsaShare(privateKeyDer: Uint8Array, shareHex: string): Uint8Array {
  const pem = forge.pki.privateKeyToPem(
    forge.pki.privateKeyFromAsn1(
      forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(privateKeyDer).toString('binary'))),
    ),
  );
  const rsa = forge.pki.privateKeyFromPem(pem);
  const clear = rsa.decrypt(forge.util.hexToBytes(shareHex.replace(/^0x/, '')), 'RSA-OAEP', {
    md: forge.md.sha256.create(),
  });
  return binaryStringToBytes(clear);
}

/** The AES key is the XOR of the two shares the onboarding event returns. */
export function recoverUserKey(privateKeyDer: Uint8Array, share0: string, share1: string): string {
  const a = decryptRsaShare(privateKeyDer, share0);
  const b = decryptRsaShare(privateKeyDer, share1);
  const key = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) key[i] = a[i] ^ b[i];
  return key.toString('hex');
}

const keyCache = new Map<string, string>();

/**
 * Onboard `signer` against a deployed `AccountOnboard` and return its AES key.
 * Cached per address for the life of the process — onboarding is idempotent but slow.
 */
export async function onboardAccount(signer: any, onboard: any): Promise<string> {
  const address = (await signer.getAddress()).toLowerCase();
  const cached = keyCache.get(address);
  if (cached) return cached;

  const { publicKey, privateKey } = generateRsaKeyPair();
  // Raw ECDSA over keccak256(publicKey), serialised r || s || (v - 27) — same shape as
  // an encrypted input's signature, and equally not `personal_sign`.
  const digest = utils.keccak256(publicKey);
  const sig = new utils.SigningKey(privateKeyFor(await signer.getAddress())).signDigest(digest);
  const signedEK = utils.hexlify(utils.concat([sig.r, sig.s, new Uint8Array([sig.recoveryParam])]));

  const rc = await (
    await onboard.connect(signer).onboardAccount(utils.hexlify(publicKey), signedEK, { gasLimit: 12_000_000 })
  ).wait();

  const ev = rc.events?.find((e: any) => e.event === 'AccountOnboarded');
  if (!ev) throw new Error(`onboarding produced no AccountOnboarded event for ${address}`);

  const key = recoverUserKey(privateKey, ev.args.userKey1, ev.args.userKey2);
  keyCache.set(address, key);
  return key;
}
