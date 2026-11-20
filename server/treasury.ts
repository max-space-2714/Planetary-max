import { formatAtomicToUsdc, parseUsdcToAtomic } from './verify-base-usdc';
const json = (body: unknown, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
export async function handleTreasury(request: Request, db: D1Database): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (request.method === 'GET' && path === '/api/admin/treasury') {
    const {results} = await db.prepare("SELECT accounting_bucket,amount_usdc FROM settlement_events WHERE accounting_bucket IN ('treasury','escrow','reallocation')").all<{accounting_bucket:string;amount_usdc:string}>();
    const totals: Record<string,bigint> = {treasury:0n,escrow:0n,reallocation:0n};
    for (const row of results) totals[row.accounting_bucket] += parseUsdcToAtomic(row.amount_usdc) ?? 0n;
    const {results: releases} = await db.prepare('SELECT release_id,CAST(amount_atomic AS TEXT) amount_atomic,destination,reference,recorded_at FROM treasury_releases ORDER BY recorded_at DESC').all<{amount_atomic:string}>();
    for (const release of releases) totals.treasury -= BigInt(release.amount_atomic);
    const destination = await db.prepare('SELECT destination FROM treasury_destination WHERE id=1').first<{destination:string}>();
    return json({ok:true,totals:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,formatAtomicToUsdc(v)])),destination:destination?.destination ?? '',releases,maxCompute:'0.000000',financial_note:'Internal bookkeeping only. Release records do not execute or prove external payments.'});
  }
  if (request.method !== 'POST') return json({error:'Method not allowed'},405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({error:'Same-origin request required'},403);
  let body: Record<string,unknown>;
  try { body = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); } catch { return json({error:'Invalid JSON'},400); }
  if (JSON.stringify(body).toUpperCase().includes('OPERATOR_NAMESPACE')) return json({error:'Forbidden namespace'},403);
  if (path === '/api/admin/treasury/destination') {
    if (typeof body.destination !== 'string' || !body.destination.trim() || body.destination.length > 256) return json({error:'Provide a wallet address or payout destination reference (no credentials)'},400);
    await db.prepare("INSERT INTO treasury_destination (id,destination) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET destination=excluded.destination,updated_at=datetime('now')").bind(body.destination.trim()).run();
    return json({ok:true});
  }
  if (path !== '/api/admin/treasury/releases') return json({error:'Not found'},404);
  const amount = typeof body.amountUsdc === 'string' ? parseUsdcToAtomic(body.amountUsdc) : null;
  if (!amount || amount > BigInt(Number.MAX_SAFE_INTEGER) || typeof body.reference !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(body.reference)) return json({error:'Invalid amount or release reference'},400);
  // One conditional INSERT serializes the balance check and debit in D1, including concurrent requests.
  try {
    const result = await db.prepare(`INSERT INTO treasury_releases (release_id,amount_atomic,destination,reference)
      SELECT ?,?,destination,? FROM treasury_destination WHERE id=1 AND
      ? <= COALESCE((SELECT SUM(CAST(REPLACE(amount_usdc,'.','') AS INTEGER)) FROM settlement_events WHERE accounting_bucket='treasury'),0)
        - COALESCE((SELECT SUM(amount_atomic) FROM treasury_releases),0)`).bind(crypto.randomUUID(),Number(amount),body.reference,Number(amount)).run();
    if (!result.meta.changes) return json({error:'Destination required or insufficient treasury balance'},409);
  } catch { return json({error:'Release reference already recorded or ledger unavailable'},409); }
  return json({ok:true,recorded:true,payment_executed:false});
}
