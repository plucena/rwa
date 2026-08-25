import logo from '../cotirwa.svg';
import type { WalletState } from '../lib/useWallet';

const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

export function Header({
  wallet, onHome, onUnlock,
}: {
  wallet: WalletState; onHome: () => void; onUnlock: () => void;
}) {
  return (
    <div className="wrap">
      <header className="header">
        <img className="logo" src={logo} alt="COTI RWA" onClick={onHome} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {wallet.address && (
            <button
              className={`wallet-chip ${wallet.aesKey ? 'ghost' : ''}`}
              onClick={wallet.aesKey ? wallet.lock : onUnlock}
              disabled={wallet.onboarding}
              title={wallet.aesKey ? 'Lock private access' : 'Unlock private access to read your balances'}
            >
              {wallet.onboarding
                ? 'Unlocking…'
                : wallet.aesKey ? '🔓 Private access on' : '🔒 Unlock private access'}
            </button>
          )}

          {wallet.address ? (
            <button
              className="wallet-chip"
              onClick={wallet.openAccount}
              title="Account details — copy address or disconnect"
            >
              {short(wallet.address)}
            </button>
          ) : (
            <button className="wallet-chip" onClick={wallet.connect} disabled={wallet.connecting}>
              {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </div>
      </header>
    </div>
  );
}
