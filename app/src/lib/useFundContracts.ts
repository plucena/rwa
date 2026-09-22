import { useCallback, useEffect, useState } from 'react';
import { formatUnits, type Address, type Hash } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { usePrivateTokenBalance } from '@coti-io/coti-wallet-plugin';
import type { Fund } from '../data/funds';
import type { WalletState } from './useWallet';
import {
  COTI_TESTNET, ERC20_ABI, PAYMENT_TOKENS, PRIVATE_TOKEN_ABI, REGISTRY_ABI, SHARE_BITS,
  SHARE_DECIMALS, SUBSCRIPTION_ABI, type Pay,
} from './contracts';

/**
 * Every onchain read and write the fund pages make. Components keep UI state only and get
 * their data and transactions from these hooks.
 */

/** The investor's payment-token balance and eligibility, and the subscribe flow. */
export function useInvest(fund: Fund, wallet: WalletState, pay: Pay) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [balance, setBalance] = useState<bigint | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

  const token = PAYMENT_TOKENS[pay];
  const live = Boolean(fund.contracts);

  const refresh = useCallback(async () => {
    if (!wallet.address || !live || !wallet.onCorrectChain || !publicClient) return;
    try {
      const [bal, isVerified] = await Promise.all([
        publicClient.readContract({
          address: token.address as Address, abi: ERC20_ABI,
          functionName: 'balanceOf', args: [wallet.address as Address],
        }),
        publicClient.readContract({
          address: fund.contracts!.registry as Address, abi: REGISTRY_ABI,
          functionName: 'isVerified', args: [wallet.address as Address],
        }),
      ]);
      setBalance(bal as bigint);
      setVerified(isVerified as boolean);
    } catch { /* testnet RPC is flaky; keep the previous values */ }
  }, [wallet.address, wallet.onCorrectChain, token.address, fund.contracts, live, publicClient]);

  useEffect(() => { void refresh(); }, [refresh]);

  /**
   * Registers eligibility if needed, approves the payment token, then subscribes. `onStep`
   * reports each stage for the UI. Resolves with the subscribe tx hash, or null when the wallet
   * isn't ready; throws when a transaction fails.
   */
  const subscribe = useCallback(async (
    value: bigint,
    onStep: (label: string) => void,
  ): Promise<Hash | null> => {
    if (!fund.contracts || !walletClient || !publicClient || !wallet.address) return null;

    const account = wallet.address as Address;
    const sub = fund.contracts.subscription as Address;

    // ERC-3643 eligibility. The demo registry is open so the UI can self-register; a real
    // deployment issues an ONCHAINID claim from a trusted issuer instead.
    if (verified === false) {
      onStep('Registering eligibility…');
      const hash = await walletClient.writeContract({
        address: fund.contracts.registry as Address, abi: REGISTRY_ABI,
        functionName: 'setVerified', args: [account, true], account, chain: null,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setVerified(true);
    }

    // Never subscribe on an unconfirmed allowance. A failed read must mean "approve again",
    // not "skip approving": `undefined < value` is false in JS rather than throwing, which
    // silently walks past the approval and reverts inside the token instead.
    const readAllowance = async (): Promise<bigint> => {
      try {
        const a = await publicClient.readContract({
          address: token.address as Address, abi: ERC20_ABI,
          functionName: 'allowance', args: [account, sub],
        });
        return typeof a === 'bigint' ? a : 0n;
      } catch {
        return 0n;
      }
    };

    let allowance = await readAllowance();
    if (allowance < value) {
      // Some ERC-20s reject a non-zero-to-non-zero approval; clear it first when set.
      if (allowance > 0n) {
        onStep(`Resetting ${pay} approval…`);
        const reset = await walletClient.writeContract({
          address: token.address as Address, abi: ERC20_ABI,
          functionName: 'approve', args: [sub, 0n], account, chain: null,
        });
        await publicClient.waitForTransactionReceipt({ hash: reset });
      }

      onStep(`Approving ${pay}…`);
      const hash = await walletClient.writeContract({
        address: token.address as Address, abi: ERC20_ABI,
        functionName: 'approve', args: [sub, value], account, chain: null,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      allowance = await readAllowance();
      if (allowance < value) {
        throw new Error(
          `Approval did not take effect — allowance is ${formatUnits(allowance, token.decimals)} ${pay}, ` +
          `need ${formatUnits(value, token.decimals)}. Try again.`,
        );
      }
    }

    onStep('Subscribing…');
    const hash = await walletClient.writeContract({
      address: sub, abi: SUBSCRIPTION_ABI,
      functionName: 'subscribe', args: [token.address as Address, value],
      account, chain: null, gas: 8_000_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    await refresh();
    return hash;
  }, [fund.contracts, walletClient, publicClient, wallet.address, verified, token, pay, refresh]);

  return { balance, subscribe };
}

/** The fund's public total supply and the investor's decrypted share balance. */
export function useHolding(fund: Fund, wallet: WalletState) {
  const publicClient = usePublicClient();
  // Decryption lives in the plugin: it reads the ctUint256 and unwraps it with the session key.
  const { fetchPrivateBalance } = usePrivateTokenBalance();

  const [holding, setHolding] = useState<string | null>(null);
  const [supply, setSupply] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!fund.contracts || !wallet.address || !wallet.onCorrectChain) return;
    try {
      if (publicClient) {
        const total = await publicClient.readContract({
          address: fund.contracts.token as Address, abi: PRIVATE_TOKEN_ABI,
          functionName: 'totalSupply',
        });
        setSupply((total as bigint).toString());
      }
      if (!wallet.aesKey) return setHolding(null);
      setHolding(await fetchPrivateBalance(
        wallet.address, wallet.aesKey, fund.contracts.token,
        SHARE_BITS, SHARE_DECIMALS, COTI_TESTNET.chainId,
      ));
    } catch { /* testnet RPC is flaky; keep the previous value */ }
  }, [fund.contracts, wallet.address, wallet.aesKey, wallet.onCorrectChain, publicClient, fetchPrivateBalance]);

  useEffect(() => { void reload(); }, [reload]);

  return { holding, supply, reload };
}
