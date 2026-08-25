import { useCallback, useEffect, useState } from 'react';
import type { Address } from 'viem';
import { usePublicClient } from 'wagmi';
import { usePrivateTokenBalance } from '@coti-io/coti-wallet-plugin';
import type { Fund } from '../data/funds';
import type { WalletState } from '../lib/useWallet';
import {
  COTI_TESTNET, PRIVATE_TOKEN_ABI, SHARE_BITS, SHARE_DECIMALS, explorerAddress,
} from '../lib/contracts';
import { InvestPanel } from './InvestPanel';

const usd = (n: number) => '$' + n.toLocaleString('en-US');

function Info() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.4" stroke="#9aa0a6" strokeWidth="1.2" />
      <path d="M8 7.2v4M8 5.1v.9" stroke="#9aa0a6" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
      <path d="M4 6l4 4 4-4" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A smooth upward NAV curve — illustrative, matching the mock's shape. */
function PerfChart() {
  const pts = Array.from({ length: 48 }, (_, i) => {
    const t = i / 47;
    return 118 + t * 7 + Math.sin(i * 0.9) * 0.28;
  });
  const w = 620, h = 190, min = 116, max = 127;
  const x = (i: number) => (i / (pts.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / (max - min)) * h;
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 190 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5a623" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#f5a623" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#fill)" />
      <path d={line} fill="none" stroke="#f5a623" strokeWidth="2" />
    </svg>
  );
}

function Accordion({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="accordion">
      <button className="accordion-head" onClick={() => setOpen(!open)}>
        {title} <Chevron open={open} />
      </button>
      {open && (
        <div className="accordion-body">
          <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export function FundDetail({
  fund, wallet, onHome, onNeedOnboard,
}: {
  fund: Fund; wallet: WalletState; onHome: () => void; onNeedOnboard: () => void;
}) {
  const publicClient = usePublicClient();
  // Decryption lives in the plugin: it reads the ctUint256 and unwraps it with the session key.
  const { fetchPrivateBalance } = usePrivateTokenBalance();

  const [tab, setTab] = useState('OVERVIEW');
  const [holding, setHolding] = useState<string | null>(null);
  const [supply, setSupply] = useState<string | null>(null);

  const loadHolding = useCallback(async () => {
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

  useEffect(() => { void loadHolding(); }, [loadHolding]);

  const TABS = ['OVERVIEW', 'DOCUMENTS', 'DEFI INTEGRATIONS', 'HOLDINGS', 'RISKS', 'SMART CONTRACTS'];

  return (
    <div className="wrap">
      <div className="crumbs">
        <a onClick={onHome}>Products</a><span>/</span>
        <a onClick={onHome}>Direct fund access</a><span>/</span>
        <span className="cur">
          <span className="fund-logo" style={{
            width: 20, height: 20, borderRadius: 5, fontSize: 9,
            background: fund.logo.bg, color: fund.logo.fg,
          }}>{fund.logo.text}</span>
          {fund.ticker}
        </span>
      </div>

      <div className="detail-head">
        <div>
          <h1 className="detail-title">{fund.name}</h1>
          <div className="detail-stats">
            <div>
              <div className="detail-stat-label">AUM</div>
              <div className="detail-stat-value">{usd(fund.aum)}</div>
            </div>
            {fund.tokenPrice !== null && (
              <div>
                <div className="detail-stat-label">Token price</div>
                <div className="detail-stat-value">${fund.tokenPrice.toFixed(6)}</div>
              </div>
            )}
            {fund.apy !== null && (
              <div>
                <div className="detail-stat-label">APY <Info /></div>
                <div className="detail-stat-value">{fund.apy.toFixed(2)}%</div>
              </div>
            )}
            {fund.ratings.length > 0 && (
              <div>
                <div className="detail-stat-label">Rating</div>
                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  {fund.ratings.map((r) => (
                    <span key={r.label} className={`rating ${r.tone}`}>{r.label}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <InvestPanel fund={fund} wallet={wallet} onNeedOnboard={onNeedOnboard} onDone={loadHolding} />
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'OVERVIEW' && (
        <div className="detail-body">
          <div>
            <h3>Overview</h3>
            <div className="issuer-card">
              <div className="issuer-name">{fund.manager}</div>
              <div className="issuer-sub">INVESTORS</div>
              <p>{fund.description}</p>
              <span className="pill">Factsheet ↗</span>
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <div className="seg">
                  <button className="active">NAV/share</button><button>AUM</button><button>APY</button>
                </div>
                <div className="seg">
                  <button>7D</button><button>1M</button><button className="active">3M</button>
                  <button>1Y</button><button>All</button>
                </div>
              </div>
              <div className="chart-price">{fund.tokenPrice?.toFixed(6) ?? '—'} USDC</div>
              <PerfChart />
            </div>

            <h3 style={{ marginTop: 44 }}>Performance</h3>
            <p className="sub" style={{ marginTop: -10 }}>Annualised net returns, as of 30 June 2026</p>
            <div className="perf-grid">
              <div className="perf-cell"><div className="k">3 months</div><div className="v">{fund.performance.threeMonths.toFixed(2)}%</div></div>
              <div className="perf-cell"><div className="k">6 months</div><div className="v">{fund.performance.sixMonths.toFixed(2)}%</div></div>
              <div className="perf-cell"><div className="k">12 months</div><div className="v">{fund.performance.twelveMonths.toFixed(2)}%</div></div>
            </div>

            <Accordion title="Overview" items={fund.overviewPoints} />
            <Accordion title="Characteristics" items={fund.characteristics} />
          </div>

          <aside>
            <div className="kv">
              <div className="kv-row"><span className="k">Issuer</span><span className="v">{fund.issuer}</span></div>
              <div className="kv-row"><span className="k">Asset type</span><span className="v">{fund.assetType}</span></div>
              <div className="kv-row"><span className="k">Ticker</span><span className="v">{fund.ticker}</span></div>
              {fund.apy !== null && <div className="kv-row"><span className="k">APY <Info /></span><span className="v">{fund.apy.toFixed(2)}%</span></div>}
              <div className="kv-row"><span className="k">Benchmark</span><span className="v">{fund.benchmark}</span></div>
              <div className="kv-row"><span className="k">Inception</span><span className="v">{fund.inception}</span></div>
              {fund.averageMaturity && <div className="kv-row"><span className="k">Average asset maturity <Info /></span><span className="v">{fund.averageMaturity}</span></div>}
              <div className="kv-row"><span className="k">Expense ratio <Info /></span><span className="v">{fund.expenseRatio}</span></div>
              <div className="kv-row"><span className="k">Entry/exit fees</span><span className="v">{fund.entryExitFees}</span></div>
              <div className="kv-row"><span className="k">Min. investment <Info /></span><span className="v">{fund.minInvestment}</span></div>
              <div className="kv-row"><span className="k">Liquidity <Info /></span><span className="v">{fund.liquidity}</span></div>
              <div className="kv-row"><span className="k">Structure</span><span className="v">{fund.structure}</span></div>
              <div className="kv-row"><span className="k">Domicile</span><span className="v">{fund.domicile}</span></div>
              <div className="kv-row"><span className="k">Eligibility</span><span className="v">{fund.eligibility}</span></div>
              <div className="kv-row"><span className="k">Risk profile <Info /></span><span className="v">{fund.riskProfile}</span></div>
              <div className="kv-row"><span className="k">Accepted stablecoins</span><span className="v">USDC · USDT</span></div>
            </div>

            <h3 style={{ marginTop: 40 }}>Service providers</h3>
            <div className="kv">
              {fund.serviceProviders.map((s) => (
                <div className="kv-row" key={s.label}><span className="k">{s.label}</span><span className="v">{s.value}</span></div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {tab === 'HOLDINGS' && (
        <div className="detail-body">
          <div className="holding-card">
            <div className="holding-sub">Your position</div>
            {!fund.contracts ? (
              <div className="holding-big">—</div>
            ) : !wallet.address ? (
              <>
                <div className="holding-big locked">000.00</div>
                <div className="holding-sub">Connect a wallet to view your balance.</div>
              </>
            ) : !wallet.aesKey ? (
              <>
                <div className="holding-big locked">000.00</div>
                <div className="holding-sub">
                  Encrypted onchain. <a onClick={onNeedOnboard} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
                    Unlock private access</a> to decrypt it.
                </div>
              </>
            ) : (
              <>
                <div className="holding-big">
                  {holding === null ? '…' : holding}
                  <span style={{ fontSize: 20, fontWeight: 600, marginLeft: 10 }}>{fund.ticker}</span>
                </div>
                <div className="holding-sub">
                  Decrypted locally with your key. Nobody else can read this value onchain.
                </div>
              </>
            )}
          </div>
          <aside>
            <div className="kv">
              <div className="kv-row"><span className="k">Total supply (public)</span>
                <span className="v">{supply ? (Number(supply) / 1e8).toLocaleString('en-US') : '—'}</span></div>
              <div className="kv-row"><span className="k">Your balance</span><span className="v">Encrypted</span></div>
            </div>
            <div className="notice" style={{ marginTop: 20 }}>
              Fund size stays public so auditors can reconcile against encrypted per-holder balances.
              Individual positions do not.
            </div>
          </aside>
        </div>
      )}

      {tab === 'SMART CONTRACTS' && (
        <div className="detail-body">
          <div>
            <h3>Deployed contracts</h3>
            {fund.contracts ? (
              <div className="kv">
                {Object.entries(fund.contracts).map(([k, v]) => (
                  <div className="kv-row" key={k}>
                    <span className="k">{k}</span>
                    <a className="v" href={explorerAddress(v)} target="_blank" rel="noreferrer"
                       style={{ textDecoration: 'underline', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{v}</a>
                  </div>
                ))}
              </div>
            ) : <div className="empty">This fund is not yet deployed on COTI testnet.</div>}
          </div>
          <aside>
            <div className="notice">
              ERC-3643 token with confidential balances. Identity and compliance rules stay public;
              amounts are encrypted with COTI’s garbled-circuit MPC.
            </div>
          </aside>
        </div>
      )}

      {['DOCUMENTS', 'DEFI INTEGRATIONS', 'RISKS'].includes(tab) && (
        <div className="empty">Not available in this testnet demo.</div>
      )}
    </div>
  );
}
