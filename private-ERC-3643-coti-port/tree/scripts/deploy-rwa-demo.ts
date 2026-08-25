/**
 * Deploy the full RWA demo stack the website talks to.
 *
 *   npx hardhat run scripts/deploy-rwa-demo.ts \
 *     --config hardhat.private.config.ts --network coti-testnet
 *
 * Deploys one fund (identity registry, compliance, PrivateToken) plus an AccountOnboard and a
 * RwaSubscription priced in the testnet USDC and USDT, then writes deployments/rwa-demo.json
 * for the frontend to read.
 */
import hre from 'hardhat';
import fs from 'fs';
import path from 'path';

const USDC = '0x63f3D2Cc8F5608F57ce6E5Aa3590A2Beb428D19C'; // Bridged USDC (USDC.e), 6dp
const USDT = '0x9e961430053cd5AbB3b060544cEcCec848693Cf0'; // Tether USD, 6dp

/** Fund shares use 8 decimals; prices are payment-token units per 1e8 shares. */
const FUNDS = [
  { key: 'JTRSY', name: 'Janus Henderson Treasury Fund', symbol: 'JTRSY', price: 1_112_439n },
  { key: 'JAAA', name: 'Janus Henderson AAA CLO Fund', symbol: 'JAAA', price: 1_044_450n },
];

async function main() {
  const { ethers, network } = hre as any;
  if (network.name === 'coti-mainnet' && process.env.ALLOW_MAINNET !== 'true') {
    throw new Error('Refusing to deploy to coti-mainnet. Set ALLOW_MAINNET=true to override.');
  }

  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  console.log(`network  ${network.name} (chainId ${net.chainId})`);
  console.log(`deployer ${deployer.address}`);
  console.log(`balance  ${ethers.utils.formatEther(await deployer.getBalance())} COTI\n`);

  const onboard = await (await ethers.getContractFactory('AccountOnboard')).deploy();
  await onboard.deployed();
  console.log(`AccountOnboard    ${onboard.address}`);

  const out: any = {
    network: network.name,
    chainId: Number(net.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    accountOnboard: onboard.address,
    paymentTokens: {
      USDC: { address: USDC, decimals: 6, symbol: 'USDC.e' },
      USDT: { address: USDT, decimals: 6, symbol: 'USDT' },
    },
    funds: {} as Record<string, unknown>,
  };

  for (const fund of FUNDS) {
    console.log(`\n--- ${fund.symbol} ---`);
    const registry = await (await ethers.getContractFactory('MockPrivateIdentityRegistry')).deploy();
    await registry.deployed();
    const compliance = await (await ethers.getContractFactory('MaxBalancePrivateCompliance')).deploy();
    await compliance.deployed();
    const token = await (await ethers.getContractFactory('PrivateToken')).deploy();
    await token.deployed();

    await (await token.init(
      registry.address, compliance.address, fund.name, fund.symbol, 8,
      ethers.constants.AddressZero,
    )).wait();
    await (await token.addAgent(deployer.address)).wait();
    await (await registry.setVerified(deployer.address, true)).wait();
    await (await token.unpause()).wait();

    const subscription = await (await ethers.getContractFactory('RwaSubscription'))
      .deploy(token.address, deployer.address);
    await subscription.deployed();

    // The subscription contract mints on subscribe, so it must be an agent of the token.
    await (await token.addAgent(subscription.address)).wait();
    await (await subscription.setPrice(USDC, fund.price)).wait();
    await (await subscription.setPrice(USDT, fund.price)).wait();

    console.log(`registry      ${registry.address}`);
    console.log(`compliance    ${compliance.address}`);
    console.log(`token         ${token.address}`);
    console.log(`subscription  ${subscription.address}`);

    out.funds[fund.key] = {
      name: fund.name,
      symbol: fund.symbol,
      decimals: 8,
      token: token.address,
      registry: registry.address,
      compliance: compliance.address,
      subscription: subscription.address,
      priceUsd: Number(fund.price) / 1e6,
    };
  }

  const dir = path.resolve(__dirname, '../deployments');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'rwa-demo.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nrecorded ${path.relative(process.cwd(), file)}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
