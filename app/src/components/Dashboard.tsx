import { FUNDS, TOTAL_AUM, type Fund } from '../data/funds';
import { explorerAddress } from '../lib/contracts';

const usd = (n: number) => '$' + n.toLocaleString('en-US');
const usdPlain = (n: number) => n.toLocaleString('en-US');

function Info() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.4" stroke="#9aa0a6" strokeWidth="1.2" />
      <path d="M8 7.2v4M8 5.1v.9" stroke="#9aa0a6" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function Clock() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.4" stroke="#6b7280" strokeWidth="1.2" />
      <path d="M8 4.6V8l2.4 1.5" stroke="#6b7280" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const INT_COLORS: Record<string, { bg: string; t: string }> = {
  morpho: { bg: '#5b48ee', t: 'M' },
  aave: { bg: '#2ebac6', t: 'A' },
  sky: { bg: '#1a1a1a', t: 'S' },
};

function FundCard({ fund, onOpen }: { fund: Fund; onOpen: (k: string) => void }) {
  return (
    <div className="card" onClick={() => onOpen(fund.key)}>
      <div className="card-top">
        <div className="fund-logo" style={{ background: fund.logo.bg, color: fund.logo.fg }}>
          {fund.logo.text}
        </div>
        <div className="card-name">{fund.name}</div>
        <div className="card-ticker">{fund.ticker}</div>
      </div>

      <div className="card-metrics">
        <div>
          <div className="metric-label">AUM (USD)</div>
          {fund.status === 'investors-only' ? (
            <span className="pill"><Clock /> Investors only</span>
          ) : fund.status === 'seeding' ? (
            <span className="pill"><Info /> Seeding soon</span>
          ) : (
            <div className="metric-value">{usdPlain(fund.aum)}</div>
          )}
        </div>
        {fund.apy !== null && (
          <div>
            <div className="metric-label">APY <Info /></div>
            <div className="metric-value">{fund.apy.toFixed(2)}%</div>
          </div>
        )}
      </div>

      <div className="card-rows">
        <div className="card-row"><span className="k">Asset type</span><span className="v">{fund.assetType}</span></div>
        <div className="card-row"><span className="k">Min. investment</span><span className="v">{fund.minInvestment}</span></div>
        {fund.integrations.length > 0 && (
          <div className="card-row">
            <span className="k">Integrations</span>
            <span className="ints">
              {fund.integrations.map((i) => (
                <span key={i} className="int" style={{ background: INT_COLORS[i]?.bg ?? '#888' }}>
                  {INT_COLORS[i]?.t ?? '?'}
                </span>
              ))}
            </span>
          </div>
        )}
        {fund.contracts && (
          <div className="card-row">
            <span className="k">Onchain</span>
            {/* Stop the click here — the card itself opens the fund detail. */}
            <a
              className="badge-live"
              href={explorerAddress(fund.contracts.token)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`View ${fund.ticker} on COTI Explorer`}
            >
              ● Live on COTI
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function Dashboard({ onOpen }: { onOpen: (key: string) => void }) {
  const live = FUNDS.filter((f) => f.contracts).length;
  return (
    <>
      <div className="wrap">
        <section className="hero">
          <h1>Access Tokenized Assets<br />on COTI RWA</h1>
          <div className="hero-stats">
            <div>
              <div className="hero-stat-label">AUM</div>
              <div className="hero-stat-value">{usd(TOTAL_AUM)}</div>
            </div>
            <div>
              <div className="hero-stat-label">Assets</div>
              <div className="hero-stat-value sm">{FUNDS.length + 5}</div>
            </div>
            <div>
              <div className="hero-stat-label">Ecosystems</div>
              <div className="hero-stat-value sm">12</div>
            </div>
          </div>
        </section>
        <div className="hero-rule" />
      </div>
      <div className="hero-rule-full" />

      <div className="wrap">
        <section className="section">
          <h2>Direct fund access</h2>
          <p className="sub">
            Subscribe and hold tokenized fund shares — {live} live on COTI testnet with confidential balances
          </p>
          <div className="grid">
            {FUNDS.map((f) => <FundCard key={f.key} fund={f} onOpen={onOpen} />)}
          </div>
        </section>
        <div style={{ height: 80 }} />
      </div>
    </>
  );
}
