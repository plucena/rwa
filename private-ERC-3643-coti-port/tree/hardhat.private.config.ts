import '@xyrusworx/hardhat-solidity-json';
import '@nomicfoundation/hardhat-toolbox';
import { HardhatUserConfig } from 'hardhat/config';
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';
import '@nomiclabs/hardhat-solhint';
import '@primitivefi/hardhat-dodoc';
import fs from 'fs';
import path from 'path';

function loadDotEnvFile(): void {
  // Falls back to the research-root .env so credentials live in one place and never
  // sit inside this vendored tree (where they risk being committed).
  const local = path.resolve(process.cwd(), '.env');
  const shared = path.resolve(process.cwd(), '../../../../.env');
  const envPath = fs.existsSync(local) ? local : shared;
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of envContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnvFile();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.25',
        settings: {
          viaIR: true,
          // COTI rejects Shanghai PUSH0 — Paris is required for deployability.
          // Matches coti-contracts/hardhat.config.ts.
          evmVersion: 'paris',
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: './contracts-private',
    cache: './cache-private',
    artifacts: './artifacts-private',
  },
  gasReporter: {
    // Gas report can keep long-lived post-test work on live RPCs; keep it opt-in for private Sepolia tests.
    enabled: process.env.ENABLE_GAS_REPORT === 'true',
  },
  networks: {
    'coti-testnet': {
      url: process.env.COTI_TESTNET_RPC_URL || 'https://testnet.coti.io/rpc',
      chainId: 7082400,
      accounts: [process.env.PRIVATE_KEY, process.env.PRIVATE_KEY2].filter(Boolean) as string[],
    },
    'coti-mainnet': {
      url: process.env.COTI_MAINNET_RPC_URL || 'https://mainnet.coti.io/rpc',
      chainId: 2632500,
      accounts: [process.env.PRIVATE_KEY, process.env.PRIVATE_KEY2].filter(Boolean) as string[],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts: process.env.MNEMONIC
        ? {
            mnemonic: process.env.MNEMONIC,
          }
        : [],
    },
  },
};

export default config;
