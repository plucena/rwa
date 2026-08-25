/** Read deployed state and exercise the MPC mint path. Usage: npx hardhat run scripts/verify-deployment.ts --config hardhat.private.config.ts --network coti-testnet */
import hre from 'hardhat';
async function main() {
  const { ethers } = hre as any;
  const d = require('../deployments/coti-testnet.json');
  const [s] = await ethers.getSigners();
  const token = await ethers.getContractAt('PrivateToken', d.contracts.PrivateToken);

  console.log('name/symbol/decimals :', await token.name(), await token.symbol(), await token.decimals());
  console.log('identityRegistry     :', await token.identityRegistry());
  console.log('compliance           :', await token.compliance());
  console.log('paused               :', await token.paused());
  console.log('isAgent(deployer)    :', await token.isAgent(s.address));
  console.log('totalSupply (public) :', (await token.totalSupply()).toString());

  console.log('\n--- exercising the MPC path: mint 1000 ---');
  const tx = await token.mint(s.address, 1000n * 10n ** 8n, { gasLimit: 6_000_000 });
  const rc = await tx.wait();
  console.log('mint tx              :', rc.transactionHash);
  console.log('gas used             :', rc.gasUsed.toString());
  const evs = rc.events?.map((e: any) => e.event).filter(Boolean) ?? [];
  console.log('events               :', evs.join(', ') || '(none decoded)');
  console.log('totalSupply after    :', (await token.totalSupply()).toString());

  const bal = await token.balanceOf(s.address);
  console.log('\nbalanceOf ciphertext :');
  console.log('  high =', bal.ciphertextHigh.toString());
  console.log('  low  =', bal.ciphertextLow.toString());
  const isSet = !bal.ciphertextHigh.isZero() || !bal.ciphertextLow.isZero();
  console.log('  -> user copy written:', isSet);
}
main().catch(e => { console.error('ERR:', e.message ?? e); process.exitCode = 1; });
