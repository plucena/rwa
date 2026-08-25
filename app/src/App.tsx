import { useState } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { FundDetail } from './components/FundDetail';
import { OnboardModal } from './components/OnboardModal';
import { AppProviders } from './providers/AppProviders';
import { useWallet } from './lib/useWallet';
import { getFund } from './data/funds';

function Shell() {
  const wallet = useWallet();
  const [route, setRoute] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const fund = route ? getFund(route) : null;

  return (
    <>
      <Header wallet={wallet} onHome={() => setRoute(null)} onUnlock={() => setUnlocking(true)} />

      {wallet.address && !wallet.onCorrectChain && (
        <div className="wrap">
          <div className="notice" style={{ marginTop: 8 }}>
            Wrong network. <a onClick={wallet.switchNetwork} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
              Switch to COTI Testnet</a> to see balances and subscribe.
          </div>
        </div>
      )}

      {fund ? (
        <FundDetail
          fund={fund}
          wallet={wallet}
          onHome={() => setRoute(null)}
          onNeedOnboard={() => setUnlocking(true)}
        />
      ) : (
        <Dashboard onOpen={setRoute} />
      )}

      {unlocking && <OnboardModal wallet={wallet} onClose={() => setUnlocking(false)} />}
    </>
  );
}

export function App() {
  return <AppProviders><Shell /></AppProviders>;
}
