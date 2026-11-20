import React, { useEffect, useRef, useState } from 'react';
type Treasury = { totals: Record<string,string>; commitments:Record<string,string>; destination:string; financial_note:string };
export default function TreasuryControls() {
  const [data,setData]=useState<Treasury>();
  const [destination,setDestination]=useState('');
  const [receipt,setReceipt]=useState('');
  const [amount,setAmount]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const saving=useRef(false);
  const [canRevise,setCanRevise]=useState(false);
  const [pendingRelease,setPendingRelease]=useState<{amountUsdc:string;reference:string;destination:string} | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('treasury-pending-release') || 'null'); } catch { return null; }
  });
  async function refresh() {
    const response=await fetch('/api/admin/treasury');
    const result=await response.json() as Treasury & {error?:string};
    if(!response.ok) throw new Error(result.error || 'Treasury unavailable');
    setData(result);setDestination(result.destination);
  }
  useEffect(()=>{void refresh().catch(e=>setMessage(String(e.message)));},[]);
  async function save(action:'destination'|'releases'|'reconcile') {
    if(saving.current)return;
    saving.current=true;setBusy(true);setMessage('');setCanRevise(false);
    try {
      let release = pendingRelease;
      if(action==='releases' && !release) {
        release={amountUsdc:amount,reference:crypto.randomUUID(),destination:data!.destination};
        sessionStorage.setItem('treasury-pending-release',JSON.stringify(release));
        setPendingRelease(release);
      }
      const response=await fetch(`/api/admin/treasury/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='destination'?{destination}:action==='reconcile'?{txHash:receipt}:release)});
      const result=await response.json() as {error?:string;releaseId?:string;recorded?:boolean};
      if(!response.ok){if(action==='releases' && result.recorded===false)setCanRevise(true);throw new Error(result.error);}
      if(action==='releases'){sessionStorage.removeItem('treasury-pending-release');setPendingRelease(null);setAmount('');}
      setMessage(action==='destination'?'Destination saved.':action==='reconcile'?'Artwork receipt reconciled.':`Release ${result.releaseId || ''} recorded. No external payment was executed.`);
      await refresh();
    } catch(e){setMessage(e instanceof Error?e.message:'Treasury unavailable');} finally {saving.current=false;setBusy(false);}
  }
  return <section className="panel" id="treasury"><h3>Treasury controls</h3>
    {data && <><h4>Verified funds available</h4><dl>{Object.entries(data.totals).map(([bucket,total])=><div key={bucket}><dt>{bucket}</dt><dd>{total} USDC</dd></div>)}</dl><h4>Unpaid commitments (not available for release)</h4><dl>{Object.entries(data.commitments).map(([bucket,total])=><div key={bucket}><dt>{bucket}</dt><dd>{total} USDC</dd></div>)}</dl><p>{data.financial_note}</p></>}
    <p>Save a Base wallet address to enable opt-in USDC payments. A payout reference can be saved for later bookkeeping releases.</p>
    <form onSubmit={e=>{e.preventDefault();void save('destination');}}><label>Payout wallet or destination reference (no credentials)<input value={destination} maxLength={256} onChange={e=>setDestination(e.target.value)} required/></label><button disabled={busy || !data}>Save destination</button></form>
    <form onSubmit={e=>{e.preventDefault();void save('releases');}}><label>Treasury release amount (USDC)<input disabled={!!pendingRelease} value={pendingRelease?.amountUsdc ?? amount} onChange={e=>setAmount(e.target.value)} pattern="[0-9]+([.][0-9]{1,6})?" required/></label><button disabled={busy || (!pendingRelease && !data?.destination)}>{pendingRelease ? 'Retry pending release' : 'Record release'}</button></form>
    {pendingRelease && <p>Pending release: {pendingRelease.amountUsdc} USDC to {pendingRelease.destination}. Reference: {pendingRelease.reference}</p>}
    {pendingRelease && canRevise && <button disabled={busy} onClick={()=>{
      sessionStorage.removeItem('treasury-pending-release');setAmount(pendingRelease.amountUsdc);setPendingRelease(null);setCanRevise(false);
    }}>Revise rejected release</button>}
    <form onSubmit={e=>{e.preventDefault();void save('reconcile');}}><label>Historical artwork transaction hash<input value={receipt} onChange={e=>setReceipt(e.target.value)} required pattern="0x[a-fA-F0-9]{64}"/></label><button disabled={busy || !data}>Reconcile verified artwork receipt</button></form>
    <p role="status">{message}</p>
  </section>;
}
