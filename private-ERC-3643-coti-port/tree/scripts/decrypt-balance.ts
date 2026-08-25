/** Decrypt the caller's balance ciphertext with PRIVATE_AES_KEY_TESTNET, proving the eager holder copy is readable. */
import hre from 'hardhat';
import crypto from 'crypto';

/** COTI/Soda scheme: ct = [cipher(16) || r(16)]; plaintext = AES-ECB(key, r) XOR cipher. */
function decryptLimb(ct: bigint, keyHex: string): Buffer {
  const buf = Buffer.from(ct.toString(16).padStart(64, '0'), 'hex'); // 32 bytes
  const cipher = buf.subarray(0, 16);
  const r = buf.subarray(16, 32);
  const c = crypto.createCipheriv('aes-128-ecb', Buffer.from(keyHex, 'hex'), null);
  c.setAutoPadding(false);
  const pad = Buffer.concat([c.update(r), c.final()]);
  return Buffer.from(pad.map((b, i) => b ^ cipher[i]));
}

async function main() {
  const { ethers } = hre as any;
  const d = require('../deployments/coti-testnet.json');
  const [s] = await ethers.getSigners();
  const key = (process.env.PRIVATE_AES_KEY_TESTNET || '').replace(/^0x/, '');
  if (!key) throw new Error('PRIVATE_AES_KEY_TESTNET missing');

  const token = await ethers.getContractAt('PrivateToken', d.contracts.PrivateToken);
  const bal = await token.balanceOf(s.address);

  const hi = decryptLimb(BigInt(bal.ciphertextHigh.toString()), key);
  const lo = decryptLimb(BigInt(bal.ciphertextLow.toString()), key);
  const value = (BigInt('0x' + hi.toString('hex')) << 128n) | BigInt('0x' + lo.toString('hex'));

  console.log('decrypted balance (raw)   :', value.toString());
  console.log('decrypted balance (8 dp)  :', (Number(value) / 1e8).toString());
  console.log('public totalSupply        :', (await token.totalSupply()).toString());
  console.log('match                     :', value === BigInt((await token.totalSupply()).toString()));
}
main().catch(e => { console.error('ERR:', e.message ?? e); process.exitCode = 1; });
