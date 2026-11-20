import React, { Suspense, useEffect, useRef, useState } from 'react';
import './BeemaxSpaceConcierge.css';
import { BASE_CHAIN_ID, BASE_NATIVE_USDC, MAX_COMPUTE_VALUE, requestOptInUsdcQuote, verifyOptInUsdcSettlement, type OptInUsdcSettlementRequest } from '../lib/beemaxBaseVerifier';

import { baseUsdcSettlementMessage } from '../shared/baseUsdcSettlementMessage';
const ChessArena = React.lazy(() => import('../modules/chess/ChessArenaView'));
export type SpaceActionId = 'sports-wager' | 'sports-predictions' | 'max-chess' | 'research-output' | 'art-media-games-store' | 'max-sovereign-options';
export interface SpaceRouteSpec {
  id: SpaceActionId;
  label: string;
  domain: 'MAX-SPORTS' | 'MAX-CHESS' | 'MAX-SPACES' | 'MAX-ART' | 'MAX-MEDIA' | 'MAX-GAMES';
  requiresOptInUsdc: boolean;
  freeAllowanceNote: string;
  guidance: string;
  targetRoute: string;
}
const PAYMENT_NOTE = 'Base Mainnet (8453) native USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913), https://mainnet.base.org. Each payment or wallet signature requires explicit approval. No automatic charges.';
export const SPACE_ROUTES: Record<SpaceActionId, SpaceRouteSpec> = {
  'sports-wager': {
    id: 'sports-wager', label: 'Place Sports Outcome Stake / Wager', domain: 'MAX-SPORTS', requiresOptInUsdc: true,
    freeAllowanceNote: 'Free telemetry and previews before limits; staking requires explicit Base (8453) USDC opt-in.',
    guidance: `BEEMAX guides you to the opt-in stake flow. ${PAYMENT_NOTE}`, targetRoute: '#/spaces/max-sports?mode=opt-in-wager',
  },
  'sports-predictions': {
    id: 'sports-predictions', label: 'Request Sports Prediction Suite Output', domain: 'MAX-SPORTS', requiresOptInUsdc: false,
    freeAllowanceNote: 'Wallet-free 0.000000 USDC output previews at 0.000000 MAX Compute; extended tiers require opt-in.',
    guidance: 'Review output-only sports predictions without private operator tools.', targetRoute: '#/spaces/max-sports?mode=prediction-output',
  },
  'max-chess': {
    id: 'max-chess', label: 'Launch MAX-CHESS App / Match', domain: 'MAX-CHESS', requiresOptInUsdc: false,
    freeAllowanceNote: 'Free play and analysis previews within free limits. P2P stakes require explicit Base (8453) USDC opt-in.',
    guidance: 'Launch local chess play and analysis without a wallet.', targetRoute: '#/spaces/max-chess',
  },
  'research-output': {
    id: 'research-output', label: 'Request Research Output', domain: 'MAX-SPACES', requiresOptInUsdc: false,
    freeAllowanceNote: 'Wallet-free 0.000000 USDC preview first; paid output tiers require explicit opt-in.',
    guidance: 'Prepare an output-only research request for your tenant session. Only finished outputs belong in the user view.', targetRoute: '#/spaces/research-output',
  },
  'art-media-games-store': {
    id: 'art-media-games-store', label: 'Browse / Order from Art, Media & Games Storefront', domain: 'MAX-ART', requiresOptInUsdc: true,
    freeAllowanceNote: 'MAX-ART, MAX-MEDIA and MAX-GAMES gallery previews are free. Orders require explicit Base (8453) USDC opt-in.',
    guidance: `Explore the gallery and storefront. ${PAYMENT_NOTE}`, targetRoute: '#/spaces/storefront',
  },
  'max-sovereign-options': {
    id: 'max-sovereign-options', label: 'Explore MAX-SOVEREIGN Options', domain: 'MAX-SPACES', requiresOptInUsdc: false,
    freeAllowanceNote: 'MAX Compute stays locked at 0.000000. Paid output tiers and P2P require explicit opt-in.',
    guidance: 'Explore output tiers across MAX-ART, MAX-GAMES, MAX-CHESS, MAX-SPORTS, MAX-MEDIA and MAX-SPACES.', targetRoute: '#/spaces/sovereign-options',
  },
};
interface BeemaxSpaceConciergeProps {
  optedInBaseUsdc: boolean;
  onNavigate?: (targetRoute: string, spec: SpaceRouteSpec) => void;
}
const readDestination = () => Object.values(SPACE_ROUTES).find(spec => spec.targetRoute === window.location.hash);

function SettlementControls({ domain, mode }: {
  domain: OptInUsdcSettlementRequest['domain'];
  mode: OptInUsdcSettlementRequest['mode'];
}) {
  const [amount, setAmount] = useState('1.000000');
  const [txHash, setTxHash] = useState('');
  const [payerAddress, setPayerAddress] = useState('');
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [status, setStatus] = useState('');
  const submit = async (verify: boolean) => {
    if (pending.current) return;
    if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(amount) || !/[1-9]/.test(amount)) {
      setStatus('Enter a positive USDC amount with up to six decimal places.');
      return;
    }
    if (verify && !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      setStatus('Enter a transaction hash containing 0x followed by 64 hexadecimal characters.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setStatus('');
    try {
      const params = { domain, mode, amountUsdc: amount.split('.')[0] + '.' + (amount.split('.')[1] || '').padEnd(6, '0'), optedIn: true as const };
      if (verify) {
        const response: unknown = await verifyOptInUsdcSettlement({ ...params, payerAddress, signature: signature as `0x${string}`, txHash: txHash as `0x${string}` });
        const verified = typeof response === 'object' && response !== null && 'verified' in response && response.verified === true;
        setStatus(verified ? 'The server reports this receipt as verified. This does not confirm an order, match or wager was created.' : 'The server has not confirmed this receipt as verified.');
      } else {
        await requestOptInUsdcQuote(params);
        setStatus('Quote request completed. No payment, order or wager was initiated.');
      }
    } catch {
      setStatus('Settlement service unavailable or request rejected. No settlement is confirmed.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return <section aria-label="Opt-in Base USDC settlement" className="beemax-settlement">
    <h4>Opt-in Base USDC • {mode}</h4>
    <p>{domain} • Base Mainnet ({BASE_CHAIN_ID}) • MAX Compute: {MAX_COMPUTE_VALUE}</p>
    <p style={{ overflowWrap: 'anywhere' }}>Native USDC: {BASE_NATIVE_USDC}</p>
    <p>Request a quote or check an existing receipt. These controls do not sign or send wallet transactions.</p>
    <form onSubmit={event => { event.preventDefault(); void submit(false); }}>
      <fieldset disabled={busy}>
        <label>USDC amount <input required inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setStatus(''); }} /></label>
        <button className="beemax-secondary-button" type="submit">Request Base USDC quote</button>
      </fieldset>
    </form>
    <form onSubmit={event => { event.preventDefault(); void submit(true); }}>
      <fieldset disabled={busy}>
        <label>Existing transaction hash <input required value={txHash} onChange={event => { setTxHash(event.target.value); setStatus(''); }} /></label>
        <label>Payer wallet address <input required pattern="0x[a-fA-F0-9]{40}" value={payerAddress} onChange={event => { setPayerAddress(event.target.value); setSignature(''); setStatus(''); }} /></label>
        <p>Explicitly sign this message in your wallet only when ready:</p>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{baseUsdcSettlementMessage(window.location.origin, { domain, mode, amountUsdc: /^(0|[1-9]\d*)(\.\d{1,6})?$/.test(amount) ? amount.split('.')[0] + '.' + (amount.split('.')[1] || '').padEnd(6, '0') : amount, txHash, payerAddress })}</pre>
        <label>Payer proof signature <input required pattern="0x[a-fA-F0-9]{130}" value={signature} onChange={event => setSignature(event.target.value)} /></label>
        <button className="beemax-secondary-button" type="submit">Verify Base USDC receipt</button>
      </fieldset>
    </form>
    <p role="status" aria-live="polite">{busy ? 'Request in progress…' : status}</p>
  </section>;
}

export const BeemaxSpaceConcierge: React.FC<BeemaxSpaceConciergeProps> = ({ optedInBaseUsdc, onNavigate }) => {
  const [selectedAction, setSelectedAction] = useState<SpaceActionId>('sports-predictions');
  const [destination, setDestination] = useState(readDestination);
  const [request, setRequest] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const update = () => { setDestination(readDestination()); setNotice(''); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const active = SPACE_ROUTES[selectedAction];
  const blocked = active.requiresOptInUsdc && !optedInBaseUsdc;
  const navigate = () => {
    if (blocked) return;
    if (onNavigate) onNavigate(active.targetRoute, active);
    else window.location.hash = active.targetRoute;
  };
  return <section aria-label="BEEMAX MAX-SPACES Concierge" className="beemax-concierge">
    <div className="beemax-concierge-header">
      <div>
        <span className="beemax-eyebrow">GUIDED NAVIGATION</span>
        <h2>BEEMAX • MAX-SPACES Guided Navigator</h2>
        <p>Output-Only Concierge • MAX Compute: <strong>0.000000</strong></p>
      </div>
      <span className="beemax-status">{optedInBaseUsdc ? 'Base (8453) USDC Opt-In Active' : 'Wallet-Free Preview Mode'}</span>
    </div>
    <p className="beemax-concierge-note">Free previews and play within free limits. No automatic charges.</p>
    <div className="beemax-action-grid">{Object.values(SPACE_ROUTES).map(spec =>
      <button className="beemax-action" key={spec.id} type="button" aria-pressed={spec.id === selectedAction} onClick={() => setSelectedAction(spec.id)}>{spec.label}</button>)}</div>
    <div className="beemax-action-detail">
      <div className="beemax-detail-header">
        <h3>{active.label} ({active.domain})</h3>
        <span className="beemax-domain">{active.domain}</span>
      </div>
      <p className="beemax-guidance">{active.guidance}</p>
      <p className="beemax-allowance">{active.freeAllowanceNote}</p>
      <div className="beemax-detail-actions">
        <button className="beemax-primary-button" type="button" disabled={blocked} onClick={navigate}>{blocked ? 'Opt In to Base (8453) USDC First to Continue' : `Continue to ${active.domain}`}</button>
        {active.id === 'art-media-games-store' && <a href="#/spaces/storefront">Browse free gallery previews</a>}
      </div>
    </div>
    {destination && <section aria-label="Selected MAX space" className="beemax-destination">
      <h3>{destination.label}</h3>
      {destination.id === 'max-chess' ? <Suspense fallback={<p>Opening free chess…</p>}><ChessArena /></Suspense>
        : destination.id === 'art-media-games-store' ? <><img src="/assets/crown-cover.png" alt="The Crown of Return gallery preview" style={{ maxWidth: '100%', width: 320 }} /><p>Free MAX-ART / MAX-MEDIA / MAX-GAMES gallery preview.</p><button className="beemax-secondary-button" disabled={!optedInBaseUsdc} onClick={() => setNotice('Use the opt-in controls below to request a quote or verify an existing receipt. No order has been created.')}>Request storefront order</button></>
        : destination.id === 'max-sovereign-options' ? <><p>Free output preview: 0.000000 USDC. MAX Compute: 0.000000.</p><p>Extended outputs, stakes and P2P settlements require explicit consent. {PAYMENT_NOTE}</p></>
        : destination.id === 'sports-wager' ? <><p>{optedInBaseUsdc ? 'Opt-in recorded for this page session. You can request a stake quote or verify an existing receipt below; no wager has been placed.' : 'Opt in to Base (8453) USDC before placing a stake. Free sports previews remain available.'}</p><p>{PAYMENT_NOTE}</p><a href="#/spaces/max-sports?mode=prediction-output">Open free sports output preview</a></>
        : <><p>{destination.freeAllowanceNote}</p><form onSubmit={event => { event.preventDefault(); setNotice('Output delivery is currently unavailable. Your draft stays in this page; no request or payment was submitted.'); }}>
          <label> {destination.id === 'research-output' ? 'Research prompt' : 'Match / prediction question'}<textarea required maxLength={4000} value={request} onChange={event => setRequest(event.target.value)} /></label>
          <button className="beemax-secondary-button" type="submit">Prepare free output request</button></form></>}
      {optedInBaseUsdc && <SettlementControls key={`${destination.id}:${destination.domain}`} domain={destination.domain}
        mode={destination.id === 'sports-wager' ? 'wager' : destination.id === 'max-chess' ? 'p2p' : destination.id === 'art-media-games-store' ? 'storefront-order' : 'paid-tier'} />}
      {notice && <p role="status">{notice}</p>}
    </section>}
  </section>;
};
export default BeemaxSpaceConcierge;
