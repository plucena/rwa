import { useCallback } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useAccountModal, useConnectModal } from '@rainbow-me/rainbowkit';
import { usePrivacyBridgeUnlock, usePrivateUnlock } from '@coti-io/coti-wallet-plugin';
import { COTI_TESTNET } from './contracts';

export interface WalletState {
  address: string | null;
  chainId: number | null;
  /** The account's COTI AES key for this session, or null while locked. */
  aesKey: string | null;
  connecting: boolean;
  onboarding: boolean;
  error: string | null;
  statusMessage: string | null;
  onCorrectChain: boolean;
  connect: () => void;
  /** RainbowKit's account sheet — copy address, or disconnect from there. */
  openAccount: () => void;
  switchNetwork: () => void;
  onboard: () => void;
  lock: () => void;
  clearError: () => void;
}

/**
 * Wallet and confidential-session state, both owned by the COTI wallet plugin.
 *
 * The AES key comes from the plugin's unlock flow — it prompts the connected wallet for a
 * signature and derives the key from that. No private key is ever handled by this app.
 */
export function useWallet(): WalletState {
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { isUnlocking, unlock, lock, statusMessage } = usePrivateUnlock();
  const { sessionAesKey } = usePrivacyBridgeUnlock();

  const connect = useCallback(() => { openConnectModal?.(); }, [openConnectModal]);

  const switchNetwork = useCallback(
    () => switchChain({ chainId: COTI_TESTNET.chainId }),
    [switchChain],
  );

  return {
    address: isConnected && address ? address : null,
    chainId: chainId ?? null,
    aesKey: sessionAesKey ?? null,
    connecting: isConnecting,
    onboarding: isUnlocking,
    error: null,
    statusMessage: statusMessage ?? null,
    onCorrectChain: chainId === COTI_TESTNET.chainId,
    connect,
    openAccount: () => openAccountModal?.(),
    switchNetwork,
    onboard: unlock,
    lock,
    clearError: () => {},
  };
}
