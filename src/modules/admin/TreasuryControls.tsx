import React, { useEffect, useState } from 'react';
type Treasury = { totals: Record<string,string>; destination:string; financial_note:string };
export default function TreasuryControls() {
  const [data,setData]=useState<Treasury>();
  const [destination,setDestination]=useState('');
  const [amount,setAmount]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [reference,setReference]=useState(()=>crypto.randomUUID());
  async function refresh() {
    const response=await fetch('/api/admin/treasury');
    const result=await response.json() as Treasury & {error?:string};
    if(!response.ok) throw new Error(result.error || 'Treasury unavailable');
    setData(result);setDestination(result.destination);
  }
  useEffect(()=>{void refresh().catch(e=>setMessage(String(e.message)));},[]);
  async function save(action:'destination'|'releases') {
    setBusy(true);setMessage('');
    try {
      const response=await fetch(`/api/admin/treasury/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='destination'?{destination}:{amountUsdc:amount,reference})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error);
      if(action==='releases')setReference(crypto.randomUUID());
      setMessage(action==='destination'?'Destination saved.':'Release recorded. No external payment was executed.');
      await refresh();
    } catch(e){setMessage(e instanceof Error?e.message:'Treasury unavailable');} finally {setBusy(false);}
  }
  return <section className="panel" id="treasury"><h3>Treasury controls</h3>
    {data && <><dl>{Object.entries(data.totals).map(([bucket,total])=><div key={bucket}><dt>{bucket}</dt><dd>{total} USDC</dd></div>)}</dl><p>{data.financial_note}</p></>}
    <p>Save a Base wallet address to enable opt-in USDC payments. A payout reference can be saved for later bookkeeping releases.</p>
    <form onSubmit={e=>{e.preventDefault();void save('destination');}}><label>Payout wallet or destination reference (no credentials)<input value={destination} maxLength={256} onChange={e=>setDestination(e.target.value)} required/></label><button disabled={busy || !data}>Save destination</button></form>
    <form onSubmit={e=>{e.preventDefault();void save('releases');}}><label>Treasury release amount (USDC)<input value={amount} onChange={e=>setAmount(e.target.value)} pattern="[0-9]+([.][0-9]{1,6})?" required/></label><button disabled={busy || !data?.destination}>Record release</button></form>
    <p role="status">{message}</p>
  </section>;
}
