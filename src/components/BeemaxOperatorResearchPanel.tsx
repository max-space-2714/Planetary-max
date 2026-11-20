import React, { useEffect, useRef, useState } from 'react';
import { BASE_CHAIN_ID, MAX_COMPUTE_VALUE, rejectBlockedNamespace } from '../lib/beemaxBaseVerifier';

interface OperatorResearchResult {
  summary?: string;
  sources?: string[];
  max_compute?: string;
  error?: string;
}

export const BeemaxOperatorResearchPanel: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'ready' | 'unavailable' | 'error'>('idle');
  const [result, setResult] = useState<OperatorResearchResult | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { activeRequest.current?.abort(); }, []);

  const handleRunResearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || activeRequest.current) return;
    if (rejectBlockedNamespace(trimmed)) {
      setStatus('error');
      setResult({ error: 'OPERATOR_NAMESPACE is blocked from query input.' });
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    setStatus('running');
    setResult(null);
    try {
      const res = await fetch('/api/hud/research-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ prompt: trimmed, maxCompute: MAX_COMPUTE_VALUE, chainId: BASE_CHAIN_ID }),
      });
      if (controller.signal.aborted) return;
      if (res.status === 404 || res.status === 501) {
        setStatus('unavailable');
        setResult({ error: 'Operator research is not available in this build. MAX Compute remains 0.000000.' });
        return;
      }
      const data: unknown = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setStatus('error');
        setResult({ error: `Research request rejected (HTTP ${res.status}).` });
        return;
      }
      if (typeof data !== 'object' || data === null ||
          ('summary' in data && typeof data.summary !== 'string') ||
          ('error' in data && typeof data.error !== 'string') ||
          ('sources' in data && (!Array.isArray(data.sources) || !data.sources.every(source => typeof source === 'string')))) {
        throw new Error('Invalid research response');
      }
      if ('max_compute' in data && data.max_compute !== MAX_COMPUTE_VALUE) {
        setStatus('error');
        setResult({ error: 'Research response rejected: MAX Compute must remain 0.000000.' });
        return;
      }
      const validated = data as OperatorResearchResult;
      setStatus(validated.error ? 'error' : 'ready');
      setResult({ ...validated, max_compute: MAX_COMPUTE_VALUE });
    } catch {
      if (!controller.signal.aborted) {
        setStatus('unavailable');
        setResult({ error: 'Research service unreachable or returned an invalid response. MAX Compute remains 0.000000.' });
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  };

  return <section aria-label="Private Portal-OS1 Operator Research Assistant" style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginTop: 16, color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 15, color: '#f8fafc' }}>Portal-OS1 • BEEMAX Live Research Assistant (Operator Only)</h3>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Explicit prompt only (zero auto-run, zero GET / writes) • MAX Compute: <strong style={{ color: '#22c55e' }}>{MAX_COMPUTE_VALUE}</strong> • Base USDC (8453) Opt-In</p>
      </div>
      <span style={{ fontSize: 11, color: '#7dd3fc', background: '#070b14', border: '1px solid #1e293b', borderRadius: 999, padding: '3px 10px' }}>AdminSessionDO Gated</span>
    </div>
    <form onSubmit={handleRunResearch} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
      <input type="text" value={prompt} disabled={status === 'running'} onChange={event => setPrompt(event.target.value)} placeholder="Ask BEEMAX for live research, sports telemetry synthesis, or market context..." aria-label="Operator research prompt" style={{ flex: '1 1 320px', minWidth: 0, background: '#070b14', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', fontSize: 13 }} />
      <button type="submit" disabled={status === 'running' || !prompt.trim()} style={{ background: status === 'running' ? '#1e293b' : '#0c2d48', color: status === 'running' ? '#94a3b8' : '#f8fafc', border: '1px solid #38bdf8', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: status === 'running' || !prompt.trim() ? 'not-allowed' : 'pointer' }}>{status === 'running' ? 'Running Query...' : 'Run Research Query'}</button>
    </form>
    <div role="status" aria-live="polite">
      {result && <div style={{ marginTop: 12, background: '#070b14', border: `1px solid ${status === 'ready' ? '#22c55e' : '#334155'}`, borderRadius: 8, padding: 12, fontSize: 12 }}>
        {result.error ? <div style={{ color: '#fbbf24' }}>{result.error}</div> : <>
          <div style={{ color: '#f8fafc', whiteSpace: 'pre-wrap' }}>{result.summary || 'No summary returned.'}</div>
          {!!result.sources?.length && <div style={{ marginTop: 8, color: '#94a3b8', overflowWrap: 'anywhere' }}>Sources: {result.sources.join(' • ')}</div>}
          <div style={{ marginTop: 6, color: '#4ade80', fontSize: 11 }}>MAX Compute: {MAX_COMPUTE_VALUE}</div>
        </>}
      </div>}
    </div>
  </section>;
};
export default BeemaxOperatorResearchPanel;
