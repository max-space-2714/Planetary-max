import { OUTPUT_TIERS } from '../shared/outputTiers';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { BASE_CHAIN_ID, BASE_NATIVE_USDC, MAX_COMPUTE_VALUE, requestOptInUsdcQuote, recordOptInOrder, verifyOptInUsdcSettlement, type OptInUsdcSettlementRequest } from '../lib/beemaxBaseVerifier';

import { HUB_MODULES, findHubModule, type HubModule, type HubModuleId, type HubPreviewId } from '../shared/hubModules';
import './MaxEverythingNav.css';
import { baseUsdcSettlementMessage } from '../shared/baseUsdcSettlementMessage';
const ChessArena = React.lazy(() => import('../modules/chess/ChessArenaView'));
export type SpaceActionId = 'sports-wager' | 'sports-predictions' | 'max-chess' | 'research-output' | 'art-media-games-store' | 'max-sovereign-options' | 'max-games' | 'max-media' | HubPreviewId;
export interface SpaceRouteSpec {
  id: SpaceActionId;
  label: string;
  domain: OptInUsdcSettlementRequest['domain'];
  requiresOptInUsdc: boolean;
  freeAllowanceNote: string;
  guidance: string;
  targetRoute: string;
}
const PAYMENT_NOTE = 'Base Mainnet (8453) native USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913), https://mainnet.base.org. Each payment or wallet signature requires explicit approval. No automatic charges.';
export const SPACE_ROUTES: Record<SpaceActionId, SpaceRouteSpec> = {
  ...Object.fromEntries(HUB_MODULES.filter(module => module.view === 'preview').map(module => [module.id, { id: module.id, label: module.title, domain: module.domain, requiresOptInUsdc: false, freeAllowanceNote: 'Free output preview. Paid tiers require explicit opt-in.', guidance: module.summary, targetRoute: module.href }])) as Record<HubPreviewId, SpaceRouteSpec>,
  'max-games': { id: 'max-games', label: 'MAX-GAMES', domain: 'MAX-GAMES', requiresOptInUsdc: false, freeAllowanceNote: 'Free output preview.', guidance: 'Explore game and interactive output previews.', targetRoute: '#/spaces/max-games' },
  'max-media': { id: 'max-media', label: 'MAX-MEDIA', domain: 'MAX-MEDIA', requiresOptInUsdc: false, freeAllowanceNote: 'Free output preview.', guidance: 'Explore media and publishing output previews.', targetRoute: '#/spaces/max-media' },
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
const panel: React.CSSProperties = { background: '#0e1525', border: '1px solid #334155', borderRadius: 10, padding: 16, marginTop: 16 };
const control: React.CSSProperties = { background: '#132238', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12 };
const readDestination = () => Object.values(SPACE_ROUTES).find(spec => spec.targetRoute === window.location.hash);

function ModuleOutputView({ moduleId }: { moduleId: HubModuleId }) {
  const [output, setOutput] = useState<HubModule>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setOutput(undefined); setError('');
    let tenant: string;
    try {
      const key = 'beemax-preview-tenant';
      const saved = sessionStorage.getItem(key);
      tenant = saved && /^[a-zA-Z0-9_-]{2,64}$/.test(saved) && !/operator_namespace/i.test(saved) ? saved : crypto.randomUUID();
      sessionStorage.setItem(key, tenant);
    } catch { tenant = crypto.randomUUID(); }
    fetch(`/api/tenant/${encodeURIComponent(tenant)}/modules/${moduleId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Module preview is unavailable.');
        const data = await response.json() as { module: HubModule };
        if (data.module?.id !== moduleId) throw new Error('Module preview is unavailable.');
        setOutput(data.module);
      })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Module preview is unavailable.'); });
    return () => controller.abort();
  }, [moduleId]);
  return <div aria-label={`${moduleId} output preview`}><h4>Public output preview</h4>
    {error ? <p role="alert">{error}</p> : output ? <p>{output.summary}</p> : <p>Loading preview…</p>}
    <p>Free preview • No wallet required • MAX Compute: 0.000000</p>
  </div>;
}

function SettlementControls({ domain, mode }: {
  domain: OptInUsdcSettlementRequest['domain'];
  mode: OptInUsdcSettlementRequest['mode'];
}) {
  const [amount, setAmount] = useState(mode === 'paid-tier' ? '5.000000' : '1.000000');
  const [tierCode,setTierCode] = useState('tier_std_5');
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof requestOptInUsdcQuote>>>();
  const [orderId, setOrderId] = useState<string>();
  const [intakeKey] = useState(() => crypto.randomUUID());
  const [sent, setSent] = useState(false);
  const params = () => ({domain, mode, ...(mode === 'paid-tier' ? {tierCode} : {}), amountUsdc: amount.split('.')[0] + '.' + (amount.split('.')[1] || '').padEnd(6, '0'), optedIn:true as const});
  const walletAction = async (action:'pay'|'sign'|'record') => {
    if (pending.current) return;
    pending.current=true; setBusy(true); setStatus('');
    try {
      if(action==='record') {
        const order=await recordOptInOrder({...params(),idempotencyKey:intakeKey});
        setOrderId(order.orderId);setStatus('Order recorded internally. No payment verified or sent.');return;
      }
      const wallet=(window as unknown as {ethereum?:{request:(args:{method:string;params?:unknown[]})=>Promise<unknown>}}).ethereum;
      if(!wallet)throw new Error('Open this page with a compatible Ethereum wallet. Wallet-free recording remains available.');
      const accounts=await wallet.request({method:'eth_requestAccounts'}) as string[];
      const payer=accounts[0];
      if(!/^0x[0-9a-f]{40}$/i.test(payer || ''))throw new Error('Wallet account unavailable');
      if(action==='pay') {
        if(sent || txHash || !quote?.payment)throw new Error('Request a payment quote first, or verify the existing transaction.');
        const chain=await wallet.request({method:'eth_chainId'});
        if(chain!=='0x2105')throw new Error('Select Base Mainnet (8453) in your wallet before paying.');
        const hash=await wallet.request({method:'eth_sendTransaction',params:[{chainId:'0x2105',from:payer,to:quote.payment.to,data:quote.payment.data,value:quote.payment.value}]});
        if(typeof hash!=='string' || !/^0x[0-9a-f]{64}$/i.test(hash))throw new Error('Wallet did not return a transaction hash. Check wallet activity before retrying.');
        setTxHash(hash);setPayerAddress(payer);setSent(true);setSignature('');
        setStatus('Transaction submitted. Wait for confirmation, then sign proof and verify. Do not pay again.');
      } else {
        if(!/^0x[0-9a-f]{64}$/i.test(txHash))throw new Error('Enter a transaction hash first.');
        const message=baseUsdcSettlementMessage(window.location.origin,{...params(),txHash,payerAddress:payer});
        const hex='0x'+Array.from(new TextEncoder().encode(message),byte=>byte.toString(16).padStart(2,'0')).join('');
        const proof=await wallet.request({method:'personal_sign',params:[hex,payer]});
        if(typeof proof!=='string')throw new Error('Wallet signature unavailable');
        setPayerAddress(payer);setSignature(proof);setStatus('Proof signed. Submit receipt verification when ready.');
      }
    } catch(error){setStatus(error instanceof Error?error.message:'Wallet request rejected');}
    finally {pending.current=false;setBusy(false);}
  };
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
      const params = { domain, mode, ...(mode === 'paid-tier' ? {tierCode} : {}), amountUsdc: amount.split('.')[0] + '.' + (amount.split('.')[1] || '').padEnd(6, '0'), optedIn: true as const };
      if (verify) {
        const response: unknown = await verifyOptInUsdcSettlement({ ...params, ...(orderId ? {orderId,idempotencyKey:intakeKey} : {}), payerAddress, signature: signature as `0x${string}`, txHash: txHash as `0x${string}` });
        const verified = typeof response === 'object' && response !== null && 'verified' in response && response.verified === true;
        setStatus(verified ? 'Payment verified and recorded in the internal ledger. Delivery remains locked; no match or wager was executed.' : 'The server has not confirmed this receipt as verified.');
      } else {
        setQuote(await requestOptInUsdcQuote(params));
        setStatus('Quote request completed. No payment, order or wager was initiated.');
      }
    } catch {
      setStatus('Settlement service unavailable or request rejected. No settlement is confirmed.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return <section aria-label="Opt-in Base USDC settlement" style={panel}>
    <h4>Opt-in Base USDC • {mode}</h4>
    <p>{domain} • Base Mainnet ({BASE_CHAIN_ID}) • MAX Compute: {MAX_COMPUTE_VALUE}</p>
    <p style={{ overflowWrap: 'anywhere' }}>Native USDC: {BASE_NATIVE_USDC}</p>
    <p>Record an order without a wallet, or explicitly pay native USDC on Base. Each wallet payment and proof signature requires your approval. Network gas fees may apply.</p>
    <button style={control} disabled={busy || !!orderId || !!txHash} onClick={()=>void walletAction('record')}>Record order without payment</button>
    {quote && <p>{quote.payment ? `Pay ${quote.amountUsdc} USDC to ${quote.payment.recipient} on Base (8453).` : 'Payment destination is not set up yet. Wallet-free order recording remains available.'}</p>}
    <button style={control} disabled={busy || !quote?.payment || !!txHash || sent} onClick={()=>void walletAction('pay')}>Pay quoted USDC with wallet</button>
    <form onSubmit={event => { event.preventDefault(); void submit(false); }}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
        {mode === 'paid-tier' && <label>Output tier <select disabled={!!orderId || !!txHash || sent} value={tierCode} onChange={event=>{const tier=OUTPUT_TIERS.find(t=>t.id===event.target.value)!;setTierCode(tier.id);setAmount(tier.priceUsdc);setQuote(undefined);}}>{OUTPUT_TIERS.filter(t=>t.priceUsdc!=='0.000000').map(t=><option key={t.id} value={t.id}>{t.tierLabel} — {t.priceUsdc} USDC</option>)}</select></label>}
        <label>USDC amount <input required disabled={mode === 'paid-tier' || !!orderId || !!txHash || sent} inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setQuote(undefined); setStatus(''); }} /></label>
        <button style={control} type="submit">Request Base USDC quote</button>
      </fieldset>
    </form>
    <form onSubmit={event => { event.preventDefault(); void submit(true); }}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, marginTop: 12 }}>
        <label>Existing transaction hash <input disabled={sent} required value={txHash} onChange={event => { setTxHash(event.target.value); setStatus(''); }} /></label>
        <label>Payer wallet address <input required pattern="0x[a-fA-F0-9]{40}" value={payerAddress} onChange={event => { setPayerAddress(event.target.value); setSignature(''); setStatus(''); }} /></label>
        <button type="button" style={control} onClick={()=>void walletAction('sign')}>Sign receipt proof with wallet</button>
        <p>Explicitly sign this message in your wallet only when ready:</p>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{baseUsdcSettlementMessage(window.location.origin, { domain, mode, ...(mode === 'paid-tier' ? {tierCode} : {}), amountUsdc: /^(0|[1-9]\d*)(\.\d{1,6})?$/.test(amount) ? amount.split('.')[0] + '.' + (amount.split('.')[1] || '').padEnd(6, '0') : amount, txHash, payerAddress })}</pre>
        <label>Payer proof signature <input required pattern="0x[a-fA-F0-9]{130}" value={signature} onChange={event => setSignature(event.target.value)} /></label>
        <button style={control} type="submit">Verify Base USDC receipt</button>
      </fieldset>
    </form>
    <p role="status" aria-live="polite">{busy ? 'Request in progress…' : status}</p>
  </section>;
}

export const BeemaxSpaceConcierge: React.FC<BeemaxSpaceConciergeProps> = ({ optedInBaseUsdc, onNavigate }) => {
  const [selectedAction, setSelectedAction] = useState<SpaceActionId>(() => readDestination()?.id || 'sports-predictions');
  const [destination, setDestination] = useState(readDestination);
  const [request, setRequest] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const update = () => { const route = readDestination(); setDestination(route); if (route) setSelectedAction(route.id); setNotice(''); };
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
  return <section aria-label="BEEMAX MAX-SPACES Concierge" style={{ ...panel, color: '#e2e8f0' }}>
    <nav className="max-everything" aria-label="Max Everything module switcher">
      <div className="max-everything-head"><div><span className="max-everything-kicker">BEEMAX / YOUR HUB</span><h2>Max Everything</h2><p>Choose a module to open its free preview.</p></div><span className="max-everything-free">0.000000 USDC</span></div>
      {(['core', 'open'] as const).map(group => <div className="max-everything-group" key={group}>
        <h3>{group === 'core' ? 'MAX modules' : 'Open modules'}</h3>
        <div className="max-everything-grid">{HUB_MODULES.filter(module => module.group === group).map(module => <a
          key={module.id} href={module.href} aria-current={destination?.targetRoute === module.href ? 'page' : undefined}
          onClick={event => { if (onNavigate) { const spec = Object.values(SPACE_ROUTES).find(route => route.targetRoute === module.href); if (spec) { event.preventDefault(); onNavigate(module.href, spec); } } }}>
          <span>{module.title}</span><span className="max-everything-arrow" aria-hidden="true">↗</span>
        </a>)}</div>
      </div>)}
    </nav>
    {destination && <section aria-label="Selected MAX space" aria-live="polite" style={panel}>
      <h3>{destination.label}</h3>
      {(findHubModule(destination.id)?.view === 'preview' || destination.id === 'max-games' || destination.id === 'max-media') ? <ModuleOutputView key={destination.id} moduleId={destination.id as HubModuleId}/>
        : destination.id === 'max-chess' ? <Suspense fallback={<p>Opening free chess…</p>}><ChessArena /></Suspense>
        : destination.id === 'art-media-games-store' ? <><img src="/assets/crown-cover.png" alt="The Crown of Return gallery preview" style={{ maxWidth: '100%', width: 320 }} /><p>Free MAX-ART / MAX-MEDIA / MAX-GAMES gallery preview.</p><button style={{ ...control, opacity: optedInBaseUsdc ? 1 : 0.5 }} disabled={!optedInBaseUsdc} onClick={() => setNotice('Use the opt-in controls below to request a quote or verify an existing receipt. No order has been created.')}>Request storefront order</button></>
        : destination.id === 'max-sovereign-options' ? <><p>Free output preview: 0.000000 USDC. MAX Compute: 0.000000.</p><p>Extended outputs, stakes and P2P settlements require explicit consent. {PAYMENT_NOTE}</p></>
        : destination.id === 'sports-wager' ? <><p>{optedInBaseUsdc ? 'Opt-in recorded for this page session. You can request a stake quote or verify an existing receipt below; no wager has been placed.' : 'Opt in to Base (8453) USDC before placing a stake. Free sports previews remain available.'}</p><p>{PAYMENT_NOTE}</p><a href="#/spaces/max-sports?mode=prediction-output">Open free sports output preview</a></>
        : <><p>{destination.freeAllowanceNote}</p><form onSubmit={event => { event.preventDefault(); setNotice('Output delivery is currently unavailable. Your draft stays in this page; no request or payment was submitted.'); }}>
          <label> {destination.id === 'research-output' ? 'Research prompt' : 'Match / prediction question'}<textarea required maxLength={4000} value={request} onChange={event => setRequest(event.target.value)} /></label>
          <button style={control} type="submit">Prepare free output request</button></form></>}
      {optedInBaseUsdc && <SettlementControls key={`${destination.id}:${destination.domain}`} domain={destination.domain}
        mode={destination.id === 'sports-wager' ? 'wager' : destination.id === 'max-chess' ? 'p2p' : destination.id === 'art-media-games-store' ? 'storefront-order' : 'paid-tier'} />}
      {notice && <p role="status">{notice}</p>}
    </section>}
    <h2>BEEMAX • MAX-SPACES Guided Navigator</h2>
    <p>Output-Only Concierge • MAX Compute: <strong>0.000000</strong> • {optedInBaseUsdc ? 'Base (8453) USDC Opt-In Active' : 'Wallet-Free Preview Mode'}</p>
    <p>Free previews and play within free limits. No automatic charges.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{Object.values(SPACE_ROUTES).filter(spec => !findHubModule(spec.id) || spec.id === 'max-chess').map(spec =>
      <button style={{ ...control, borderColor: spec.id === selectedAction ? '#38bdf8' : '#475569' }} key={spec.id} type="button" aria-pressed={spec.id === selectedAction} onClick={() => setSelectedAction(spec.id)}>{spec.label}</button>)}</div>
    <div style={panel}>
      <h3>{active.label} ({active.domain})</h3><p>{active.guidance}</p><p>{active.freeAllowanceNote}</p>
      <button style={{ ...control, opacity: blocked ? 0.5 : 1 }} type="button" disabled={blocked} onClick={navigate}>{blocked ? 'Opt In to Base (8453) USDC First to Continue' : `Continue to ${active.domain}`}</button>
      {active.id === 'art-media-games-store' && <p><a href="#/spaces/storefront">Browse free gallery previews</a></p>}
    </div>
  </section>;
};
export default BeemaxSpaceConcierge;
