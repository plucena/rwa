import type { WalletState } from '../lib/useWallet';

/**
 * Private-access unlock.
 *
 * The COTI wallet plugin owns this flow: it prompts the connected wallet for a signature and
 * derives the account's AES key from it, then holds the key for the session. Nothing here
 * touches a private key, and the plugin renders its own wallet prompt — this modal only
 * explains what is about to happen and calls `unlock()`.
 */
export function OnboardModal({ wallet, onClose }: { wallet: WalletState; onClose: () => void }) {
  const step = wallet.aesKey ? 3 : wallet.address ? 2 : 1;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Unlock private access</h3>
        <p>
          Everything you hold on COTI RWA is encrypted onchain. Unlocking derives your account’s
          encryption key from a wallet signature so this app can read your own balances — and only
          yours.
        </p>

        <ol className="steps">
          <li className={`step ${step > 1 ? 'done' : 'active'}`}>
            <span className="step-dot">{step > 1 ? '✓' : '1'}</span>
            <span className="step-txt">
              <span className="t">Connect your wallet</span>
              <span className="d">COTI Testnet, chain 7082400</span>
            </span>
          </li>
          <li className={`step ${step > 2 ? 'done' : step === 2 ? 'active' : ''}`}>
            <span className="step-dot">{step > 2 ? '✓' : '2'}</span>
            <span className="step-txt">
              <span className="t">Sign to derive your key</span>
              <span className="d">Your wallet will ask you to sign. The key never leaves your device.</span>
            </span>
          </li>
          <li className={`step ${step > 2 ? 'active' : ''}`}>
            <span className="step-dot">3</span>
            <span className="step-txt">
              <span className="t">Subscribe to a fund</span>
              <span className="d">Pay in USDC or USDT; your share balance is encrypted from the start.</span>
            </span>
          </li>
        </ol>

        {wallet.aesKey ? (
          <button className="cta" onClick={onClose}>Done</button>
        ) : !wallet.address ? (
          <button className="cta" onClick={wallet.connect} disabled={wallet.connecting}>
            {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        ) : (
          <>
            <button className="cta" onClick={wallet.onboard} disabled={wallet.onboarding}>
              {wallet.onboarding
                ? <><span className="spinner" /> {wallet.statusMessage || 'Unlocking…'}</>
                : 'Unlock private access'}
            </button>
            {wallet.statusMessage && !wallet.onboarding && (
              <div className="panel-note">{wallet.statusMessage}</div>
            )}
            <button className="cta secondary" onClick={onClose} style={{ marginTop: 10 }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
