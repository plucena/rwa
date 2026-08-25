import { useEffect, useState, type ReactNode } from 'react';
import {
  WagmiRainbowKitProvider,
  PrivacyBridgeProvider,
  configureCotiPlugin,
  cotiTestnet,
  type EncryptedAesBackup,
} from '@coti-io/coti-wallet-plugin';
import '@rainbow-me/rainbowkit/styles.css';
import { COTI_TESTNET } from '../lib/contracts';

const AES_BACKUP_PREFIX = 'coti-rwa:aes-backup';

const aesBackupKey = (chainId: number | string, address: string) =>
  `${AES_BACKUP_PREFIX}:${chainId}:${address.toLowerCase()}`;

/** Must run once, in the browser, before any wallet-plugin hook mounts. */
let configured = false;
function ensureConfigured() {
  if (configured) return;
  configured = true;
  configureCotiPlugin({
    // The plugin requires a WalletConnect project id even to initialise. Injected wallets
    // work without a real one; WalletConnect flows do not.
    walletConnectProjectId:
      import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '00000000000000000000000000000000',
    debug: import.meta.env.DEV,
    defaultNetworkId: String(COTI_TESTNET.chainId),
    // Without these callbacks the plugin has nowhere to keep the key, so every visit
    // re-runs contract onboarding. What is stored is the plugin's encrypted backup blob —
    // the AES key is sealed under an EIP-712 signature from the same account, so a later
    // unlock only needs that signature, and the stored blob is useless to anyone else.
    onboardingServices: {
      mode: 'custom',
      fetchEncryptedAesBackup: async ({ chainId, address }) => {
        const key = aesBackupKey(chainId, address);
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as EncryptedAesBackup;
        } catch {
          localStorage.removeItem(key);
          return null;
        }
      },
      saveEncryptedAesBackup: async ({ chainId, address, backup }) => {
        localStorage.setItem(aesBackupKey(chainId, address), JSON.stringify(backup));
      },
      replaceEncryptedAesBackup: async ({ chainId, address, backup }) => {
        localStorage.setItem(aesBackupKey(chainId, address), JSON.stringify(backup));
      },
      deleteEncryptedAesBackup: async ({ chainId, address }) => {
        localStorage.removeItem(aesBackupKey(chainId, address));
      },
    },
  });
}

/**
 * wagmi + RainbowKit + COTI privacy bridge.
 *
 * Client-only: the plugin and the injected provider both touch browser globals at module
 * scope, so the tree is withheld until the first effect has run.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { ensureConfigured(); setReady(true); }, []);
  if (!ready) return null;

  return (
    <WagmiRainbowKitProvider
      appName="COTI RWA"
      initialChain={cotiTestnet}
      useEip6963MetaMask
      walletConnectProjectId={
        import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '00000000000000000000000000000000'
      }
    >
      <PrivacyBridgeProvider>{children}</PrivacyBridgeProvider>
    </WagmiRainbowKitProvider>
  );
}
