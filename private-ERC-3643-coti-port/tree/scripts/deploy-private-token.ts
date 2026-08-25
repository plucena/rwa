/**
 * Deploy the ported private ERC-3643 suite to a COTI network.
 *
 *   npx hardhat run scripts/deploy-private-token.ts \
 *     --config hardhat.private.config.ts --network coti-testnet
 *
 * Deploys a minimal but complete suite: an identity registry, a compliance contract
 * with the MaxBalance module semantics, and the PrivateToken itself, then wires them
 * together and records the addresses in deployments/<network>.json.
 *
 * Safety: refuses to run against coti-mainnet unless ALLOW_MAINNET=true is set, and
 * refuses to start if the deployer cannot pay for the transactions.
 */
import hre from 'hardhat';
import fs from 'fs';
import path from 'path';

const TOKEN_NAME = 'Private T-REX Port';
const TOKEN_SYMBOL = 'pTREX';
const TOKEN_DECIMALS = 8; // matches the SkyBridge funds on Avalanche
const MAX_BALANCE = 1_000_000n * 10n ** 8n;

async function main() {
  const { ethers, network } = hre as any;

  const net = await ethers.provider.getNetwork();
  if (network.name === 'coti-mainnet' && process.env.ALLOW_MAINNET !== 'true') {
    throw new Error('Refusing to deploy to coti-mainnet. Set ALLOW_MAINNET=true to override.');
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error('No signer. Set PRIVATE_KEY in .env.');
  }

  const balance = await deployer.getBalance();
  console.log(`network    ${network.name} (chainId ${net.chainId})`);
  console.log(`deployer   ${deployer.address}`);
  console.log(`balance    ${ethers.utils.formatEther(balance)} COTI`);
  if (balance.isZero()) {
    throw new Error('Deployer balance is zero — fund the account before deploying.');
  }
  console.log('');

  // 1. Identity registry. The port leaves identity in cleartext by design: verification
  //    is a public regulatory fact, only amounts are confidential.
  const Registry = await ethers.getContractFactory('MockPrivateIdentityRegistry');
  const registry = await Registry.deploy();
  await registry.deployed();
  console.log(`registry   ${registry.address}`);

  // 2. Compliance. MaxBalancePrivateCompliance is the one module upstream ported; it keeps an
  //    encrypted shadow ledger, which is the dual-ledger problem solved under encryption.
  const Compliance = await ethers.getContractFactory('MaxBalancePrivateCompliance');
  const compliance = await Compliance.deploy();
  await compliance.deployed();
  console.log(`compliance ${compliance.address}`);

  // 3. The token.
  const Token = await ethers.getContractFactory('PrivateToken');
  const token = await Token.deploy();
  await token.deployed();
  console.log(`token      ${token.address}`);
  console.log('');

  // 4. Wire the suite together.
  await (await token.init(
    registry.address,
    compliance.address,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    TOKEN_DECIMALS,
    ethers.constants.AddressZero,
  )).wait();
  console.log('init       ok');

  await (await compliance.bindToken(token.address)).wait();
  console.log('bindToken  ok');

  await (await token.addAgent(deployer.address)).wait();
  console.log('addAgent   ok');

  await (await registry.setVerified(deployer.address, true)).wait();
  console.log('verified   ok');

  await (await compliance.setMaxBalance(deployer.address, MAX_BALANCE)).wait();
  console.log('maxBalance ok');

  const record = {
    network: network.name,
    chainId: Number(net.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    evmVersion: 'paris',
    solc: '0.8.25',
    contracts: {
      PrivateToken: token.address,
      MaxBalancePrivateCompliance: compliance.address,
      MockPrivateIdentityRegistry: registry.address,
    },
    token: { name: TOKEN_NAME, symbol: TOKEN_SYMBOL, decimals: TOKEN_DECIMALS },
  };

  const outDir = path.resolve(__dirname, '../deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2) + '\n');

  console.log('');
  console.log(`recorded   ${path.relative(process.cwd(), outFile)}`);
  console.log('');
  console.log('NOTE: the token is deployed paused (init sets _tokenPaused = true).');
  console.log('      Call unpause() before attempting transfers.');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
