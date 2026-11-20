import React, { useEffect, useState } from 'react';
import { sportsDataSource, type PeerChallenge, type SportsMarket, type SportsSelection } from './sportsIntegration';
import './sports-suite.css';
const leagues = ['All leagues', 'NFL', 'NBA', 'MLB', 'SOCCER', 'MMA'];
type Space = 'sportsbook' | 'p2p' | 'predictive';
const spaces: { id: Space; icon: string; title: string; description: string }[] = [
  { id: 'sportsbook', icon: '↗', title: 'Sportsbook', description: 'Markets, selections & your wager slip' },
  { id: 'p2p', icon: '⇄', title: 'P2P Stakes', description: 'Peer challenges & matched positions' },
  { id: 'predictive', icon: '⌁', title: 'Predictive Suite', description: 'Published picks & matchup research' },
];
export default function SportsSuite({ children }: { children: React.ReactNode }) {
  const [space, setSpace] = useState<Space>('sportsbook');
  return <div className="module-view max-sports-suite">
    <header className="sports-suite-hero"><div><span className="eyebrow">03 / MAX SPORTS · P2P STAKES & WAGERING</span><h1>The game.<br/><em>Every angle.</em></h1><p>Your home for sportsbook markets, peer-to-peer stakes and predictive research.</p><span className="sports-suite-status"><i/> Wagering integration pending</span></div><div className="sports-court" aria-hidden="true"><div/><span>MAX<br/><b>SPORTS</b></span><small>STAKES / MARKETS / INTELLIGENCE</small></div></header>
    <nav className="sports-suite-nav" aria-label="MAX SPORTS sections">{spaces.map(item => <button key={item.id} aria-pressed={space === item.id} onClick={() => setSpace(item.id)}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.description}</small></div><b>↗</b></button>)}</nav>
    {space === 'sportsbook' ? <Sportsbook/> : space === 'p2p' ? <PeerStakes/> : <section className="sports-predictive" aria-label="Predictive Suite"><div className="sports-section-intro"><span className="eyebrow">PREDICTIVE SUITE</span><h2>Research the matchup.</h2><p>Explore operator-published picks, reported confidence and source counts.</p></div>{children}</section>}
  </div>;
}
function useSportsData<T>(load: (signal: AbortSignal) => Promise<T[] | null>) {
  const [data, setData] = useState<T[] | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    load(controller.signal).then(value => { if (!controller.signal.aborted) setData(value); }).catch(() => { if (!controller.signal.aborted) setError('The data source could not be loaded. Try refreshing.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, version]);
  return { data, error, loading, refresh: () => setVersion(v => v + 1) };
}
function Sportsbook() {
  const { data, error, loading, refresh } = useSportsData<SportsMarket>(sportsDataSource.markets);
  const [league, setLeague] = useState('All leagues'); const [market, setMarket] = useState('All markets');
  const [selection, setSelection] = useState<{ event: string; market: string; outcome: SportsSelection } | null>(null);
  const [stake, setStake] = useState('');
  const visible = (data || []).filter(item => (league === 'All leagues' || item.league === league) && (market === 'All markets' || item.market === market));
  // A refreshed quote must be selected again; an old slip is not an executable order.
  useEffect(() => { setSelection(null); }, [data]);
  return <div className="sports-suite-columns"><section className="sports-suite-panel"><header><div><span className="eyebrow">MARKET EXPLORER</span><h2>Find your matchup.</h2></div><button onClick={refresh} disabled={loading}>Refresh markets ↻</button></header><div className="sports-suite-filters"><label>League<select value={league} onChange={e => setLeague(e.target.value)}>{leagues.map(l => <option key={l}>{l}</option>)}</select></label><label>Market<select value={market} onChange={e => setMarket(e.target.value)}>{['All markets', 'Moneyline', 'Spread', 'Totals'].map(m => <option key={m}>{m}</option>)}</select></label></div>
      {loading ? <p role="status">Loading markets…</p> : error ? <p role="alert">{error}</p> : data === null ? <Empty icon="↗" title="Your market board starts here." text="Connect your event and odds feed to display sportsbook markets. No live markets are connected yet."/> : !visible.length ? <Empty icon="↗" title="No markets to display." text="No markets match the selected league and market filters."/> : <div className="sports-market-list">{visible.map(item => <article key={item.id}><span className="eyebrow">{item.league} · {item.market}</span><h3>{item.event}</h3><p>{new Date(item.startsAt).toLocaleString()}</p><div>{item.selections.map(outcome => <button key={outcome.id} onClick={() => setSelection({ event: item.event, market: item.market, outcome })}>{outcome.label}<strong>{Number.isFinite(outcome.decimalOdds) ? outcome.decimalOdds.toFixed(2) : '—'}</strong></button>)}</div></article>)}</div>}
    </section><aside className="sports-suite-panel sports-slip" aria-label="Wager slip"><span className="eyebrow">WAGER SLIP / SINGLE</span><h2>Your position.</h2>{selection ? <div className="sports-slip-selection"><p>{selection.event}</p><strong>{selection.outcome.label}</strong><p>{selection.market} · Decimal odds {selection.outcome.decimalOdds}</p><button onClick={() => setSelection(null)}>Remove selection</button></div> : <p>Select an outcome from a connected market to preview your wager.</p>}<label>Stake amount<input type="number" min="0.01" step="0.01" value={stake} onChange={e => setStake(e.target.value)} placeholder="Enter amount"/></label><dl><div><dt>Selection</dt><dd>{selection ? '1' : '—'}</dd></div><div><dt>Funding</dt><dd>Not connected</dd></div><div><dt>Settlement</dt><dd>Not connected</dd></div></dl><button className="sports-primary" disabled>Place wager · unavailable</button><p className="sports-suite-note">Selections are a local preview. No wager is submitted and no funds are accepted.</p></aside></div>;
}
function PeerStakes() {
  const { data, error, loading, refresh } = useSportsData<PeerChallenge>(sportsDataSource.challenges);
  const [status, setStatus] = useState('open'); const [draft, setDraft] = useState<{ event: string; selection: string; stake: string; currency: string; market: string } | null>(null);
  const visible = (data || []).filter(item => item.status === status);
  return <div className="sports-suite-columns"><section className="sports-suite-panel"><header><div><span className="eyebrow">PEER-TO-PEER STAKES</span><h2>Take the other side.</h2></div><button disabled={loading} onClick={refresh}>Refresh challenges ↻</button></header><div className="sports-status-filter" aria-label="Challenge status">{['open', 'matched', 'settled'].map(value => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{value}</button>)}</div>{loading ? <p role="status">Loading peer challenges…</p> : error ? <p role="alert">{error}</p> : data === null ? <Empty icon="⇄" title="Built for peer-to-peer play." text="Connect your challenge and matching service to list open stakes, matched positions and settlement records."/> : !visible.length ? <Empty icon="⇄" title={`No ${status} challenges.`} text="Challenges from your connected service will appear here."/> : <div className="sports-market-list">{visible.map(item => <article key={item.id}><span className="eyebrow">{item.league} · {item.status}</span><h3>{item.event}</h3><p>{item.market} · {item.selection}</p><strong>{item.stake} {item.currency}</strong><button disabled>Challenge actions unavailable</button></article>)}</div>}</section><aside className="sports-suite-panel sports-slip"><span className="eyebrow">CHALLENGE BUILDER</span><h2>Set your terms.</h2><form onSubmit={e => { e.preventDefault(); const values = new FormData(e.currentTarget); setDraft({ event: String(values.get('event')), selection: String(values.get('selection')), stake: String(values.get('stake')), currency: String(values.get('currency')), market: String(values.get('market')) }); }}><label>Event / matchup<input name="event" required maxLength={200} placeholder="Enter a matchup"/></label><label>Market<select name="market"><option>Moneyline</option><option>Spread</option><option>Totals</option></select></label><label>Your selection<input name="selection" required maxLength={160} placeholder="Team, player or outcome"/></label><div className="sports-stake-fields"><label>Stake amount<input name="stake" type="number" min="0.01" step="0.01" required placeholder="0.00"/></label><label>Currency<select name="currency"><option>USDC</option></select></label></div><button className="sports-secondary">Preview challenge draft</button></form>{draft && <div className="sports-draft" role="status"><span className="eyebrow">LOCAL DRAFT PREVIEW</span><h3>{draft.event}</h3><p>{draft.market} · {draft.selection}</p><strong>{draft.stake} {draft.currency}</strong><p>Draft only. No challenge has been published.</p></div>}<button className="sports-primary" disabled>Publish stake · unavailable</button><p className="sports-suite-note">Drafts stay in this view and clear when you leave it. Matching, funding and settlement await your implementation.</p></aside></div>;
}
function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="sports-suite-empty"><span aria-hidden="true">{icon}</span><h3>{title}</h3><p>{text}</p></div>;
}
