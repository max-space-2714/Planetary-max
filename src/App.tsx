import React, { Suspense, useEffect, useState } from 'react';
import { CollectorVault } from './modules/art/CollectorCheckout';
import LandingEntry from './pages/LandingEntry';

const CommandHud = React.lazy(() => import('./components/BeemaxPortalCommandHud'));
const AdminConsole = React.lazy(() => import('./modules/admin/PortalOS1Console'));
const readRoute = () => window.location.hash.replace(/^#/, '').split('?')[0].toLowerCase();

function PrivateCommandSession() {
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    let current: AbortController | undefined;
    let disposed = false;
    const verify = async () => {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      setVerified(false);
      try {
        const response = await fetch('/api/auth/command-session', {
          credentials: 'same-origin', cache: 'no-store',
          headers: { Accept: 'application/json' }, signal: controller.signal,
        });
        const session: unknown = await response.json();
        if (!disposed && !controller.signal.aborted) {
          setVerified(response.ok && typeof session === 'object' && session !== null &&
            'authenticated' in session && session.authenticated === true);
        }
      } catch { if (!disposed && !controller.signal.aborted) setVerified(false); }
    };
    void verify();
    window.addEventListener('focus', verify);
    const timer = window.setInterval(verify, 60_000);
    return () => { disposed = true; current?.abort(); clearInterval(timer); window.removeEventListener('focus', verify); };
  }, []);
  if (!verified) return <main style={{ padding: 24 }}><h1>Private Portal-OS1 Command HUD Locked</h1>
    <p>A verified operator session is required. Public BEEMAX previews remain wallet-free at MAX Compute: 0.000000.</p>
    <a href="#/admin">Operator sign-in</a> · <a href="#/">Return to Public Hub</a></main>;
  return <Suspense fallback={<p>Loading private command view…</p>}><CommandHud /></Suspense>;
}

export default function App() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (window.location.pathname.startsWith('/vault/')) return <CollectorVault />;
  if (route === '/hud' || route === '/portal-os1') return <PrivateCommandSession key={route} />;
  if (route === '/admin' || window.location.pathname.replace(/\/$/, '') === '/admin') {
    return <Suspense fallback={<p>Loading sign-in…</p>}><AdminConsole /></Suspense>;
  }
  return <LandingEntry />;
}
