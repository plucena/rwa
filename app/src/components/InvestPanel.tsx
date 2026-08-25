import { useCallback, useEffect, useState } from 'react';
import { formatUnits, parseUnits, type Address } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import type { Fund } from '../data/funds';
import type { WalletState } from '../lib/useWallet';
import {
  DEPLOYMENT, ERC20_ABI, REGISTRY_ABI, SUBSCRIPTION_ABI, explorerTx,
} from '../lib/contracts';

type Tab = 'Invest' | 'Redeem' | 'Instant' | 'Bridge';
type Pay = 'USDC' | 'USDT';

const TOKENS = DEPLOYMENT.paymentTokens as Record<Pay, { address: string; decimals: number; symbol: string }>;

export function InvestPanel({
  fund, wallet, onNeedOnboard, onDone,
}: {
  fund: Fund;
  wallet: WalletState;
  onNeedOnboard: () => void;
  onDone: () => void;
}) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [tab, setTab] = useState<Tab>('Invest');
  const [pay, setPay] = useState<Pay>('USDC');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<bigint | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const token = TOKENS[pay];
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

  const shares = (() => {
    const px = fund.tokenPrice ?? 0;
    const n = Number(amount);
    if (!px || !Number.isFinite(n) || n <= 0) return 0;
    return n / px;
  })();

  const insufficient =
    balance !== null && amount !== '' && Number(amount) > 0 &&
    parseUnits(amount || '0', token.decimals) > balance;

  async function invest() {
    setErr(null); setDone(null);
    if (!fund.contracts || !walletClient || !publicClient || !wallet.address) return;

    try {
      const value = parseUnits(amount, token.decimals);
      const account = wallet.address as Address;
      const sub = fund.contracts.subscription as Address;

      // ERC-3643 eligibility. The demo registry is open so the UI can self-register; a real
      // deployment issues an ONCHAINID claim from a trusted issuer instead.
      if (verified === false) {
        setBusy('Registering eligibility…');
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
          setBusy(`Resetting ${pay} approval…`);
          const reset = await walletClient.writeContract({
            address: token.address as Address, abi: ERC20_ABI,
            functionName: 'approve', args: [sub, 0n], account, chain: null,
          });
          await publicClient.waitForTransactionReceipt({ hash: reset });
        }

        setBusy(`Approving ${pay}…`);
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

      setBusy('Subscribing…');
      const hash = await walletClient.writeContract({
        address: sub, abi: SUBSCRIPTION_ABI,
        functionName: 'subscribe', args: [token.address as Address, value],
        account, chain: null, gas: 8_000_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      setDone(hash);
      setAmount('');
      await refresh();
      onDone();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.details || e?.message || 'Transaction failed');
    } finally {
      setBusy(null);
    }
  }

  const cta = (() => {
    if (!wallet.address) return { label: 'Connect wallet', fn: wallet.connect, disabled: false };
    if (!wallet.onCorrectChain) return { label: 'Switch to COTI Testnet', fn: wallet.switchNetwork, disabled: false };
    if (!live) return { label: 'Not yet available', fn: () => {}, disabled: true };
    if (!wallet.aesKey) return { label: 'Unlock private access', fn: onNeedOnboard, disabled: false };
    if (busy) return { label: busy, fn: () => {}, disabled: true };
    if (!amount || Number(amount) <= 0) return { label: 'Enter an amount', fn: () => {}, disabled: true };
    if (insufficient) return { label: `Insufficient ${pay}`, fn: () => {}, disabled: true };
    return { label: 'Invest', fn: invest, disabled: false };
  })();

  return (
    <div className="panel">
      <div className="panel-tabs">
        {(['Invest', 'Redeem', 'Instant', 'Bridge'] as Tab[]).map((t) => (
          <button key={t} className={`panel-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="panel-body">
        {tab === 'Invest' && (
          <>
            <div className="field-head">
              <span className="lab">You invest</span>
              <span className="hint">Min. 1 {pay}</span>
            </div>

            <div className="amount-row">
              <input
                className="amount-input"
                placeholder="0.00"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              />
              <label className="token-select">
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <select value={pay} onChange={(e) => setPay(e.target.value as Pay)}>
                    <option value="USDC">USDC</option>
                    <option value="USDT">USDT</option>
                  </select>
                  <span className="net">COTI Testnet</span>
                </span>
              </label>
            </div>

            <div className="max-row">
              <button
                className="max-btn"
                onClick={() => balance !== null && setAmount(formatUnits(balance, token.decimals))}
              >
                MAX
              </button>
              <span className={`max-note ${insufficient ? 'err' : ''}`}>
                {balance === null
                  ? `Connect to see your ${pay} balance`
                  : `${Number(formatUnits(balance, token.decimals)).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${pay} available`}
              </span>
            </div>

            {shares > 0 && (
              <div className="panel-note">
                You receive ≈ <strong>{shares.toLocaleString('en-US', { maximumFractionDigits: 6 })} {fund.ticker}</strong>
                {' '}at {fund.tokenPrice?.toFixed(6)} {pay} per share.
              </div>
            )}

            <button className="cta" onClick={cta.fn} disabled={cta.disabled}>
              {busy ? <><span className="spinner" /> {busy}</> : cta.label}
            </button>

            {err && <div className="panel-err">{err}</div>}
            {done && (
              <div className="panel-note">
                Subscribed. <a href={explorerTx(done)} target="_blank" rel="noreferrer"
                  style={{ textDecoration: 'underline' }}>View transaction</a> — your new balance is
                encrypted onchain.
              </div>
            )}

            <div className="panel-note" style={{ marginTop: 16 }}>
              Your share balance is <strong>confidential</strong>: stored encrypted and readable only with
              your key. The {pay} payment itself is a public ERC-20 transfer, so this subscription’s size
              is visible onchain — confidentiality begins at the first transfer.
            </div>
          </>
        )}

        {tab === 'Redeem' && (
          <>
            <div className="field-head"><span className="lab">You redeem</span></div>
            <div className="amount-row">
              <input className="amount-input" placeholder="0.00" disabled />
              <span className="token-select"><span className="sym">{fund.ticker}</span></span>
            </div>
            <button className="cta" disabled>Redemptions open at T+1</button>
            <div className="panel-note">
              Redemption is processed by the fund agent against NAV. Not enabled in this testnet demo.
            </div>
          </>
        )}

        {tab === 'Instant' && (
          <>
            <div className="panel-note" style={{ marginTop: 0 }}>
              Instant settlement routes through a liquidity provider rather than the fund’s subscription
              queue. Not enabled in this testnet demo.
            </div>
            <button className="cta" disabled style={{ marginTop: 16 }}>Unavailable</button>
          </>
        )}

        {tab === 'Bridge' && (
          <>
            <div className="panel-note" style={{ marginTop: 0, marginBottom: 14 }}>Send tokens cross-chain.</div>
            <div className="field-head"><span className="lab">From</span></div>
            <div className="pill" style={{ width: '100%', justifyContent: 'space-between' }}>COTI Testnet</div>
            <div className="field-head" style={{ marginTop: 16 }}><span className="lab">To</span></div>
            <div className="pill" style={{ width: '100%', justifyContent: 'space-between' }}>Select a network</div>
            <div className="panel-err">
              Bridging would publish the amount in cleartext — confidentiality is chain-local, so this
              route is disabled rather than silently leaking.
            </div>
            <button className="cta" disabled style={{ marginTop: 16 }}>Bridge</button>
          </>
        )}
      </div>
    </div>
  );
}
