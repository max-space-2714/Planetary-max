import { formatAtomicToUsdc, parseUsdcToAtomic } from './verify-base-usdc';
const json = (body: unknown, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
export async function handleTreasury(request: Request, db: D1Database): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (request.method === 'GET' && path === '/api/admin/treasury') {
    const {totals, commitments} = await balances(db);
    const {results: releases} = await db.prepare('SELECT release_id,CAST(amount_atomic AS TEXT) amount_atomic,destination,reference,recorded_at FROM treasury_releases ORDER BY recorded_at DESC').all();
    const destination = await db.prepare('SELECT destination FROM treasury_destination WHERE id=1').first<{destination:string}>();
    return json({ok:true,totals:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,formatAtomicToUsdc(v)])),commitments:formatTotals(commitments),destination:destination?.destination ?? '',releases,maxCompute:'0.000000',financial_note:'Internal bookkeeping only. Release records do not execute or prove external payments.'});
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
  if (!amount || amount > BigInt(Number.MAX_SAFE_INTEGER) || typeof body.reference !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(body.reference)) return json({error:'Invalid amount or release reference',recorded:false},400);
  if (body.destination !== undefined && (typeof body.destination !== 'string' || body.destination.length > 256)) return json({error:'Invalid destination',recorded:false},400);
  // Recover before checking today's balance or destination. An exact retry must
  // return the original immutable release even after funds/destination change.
  const recover = async (): Promise<Response | null> => {
    const prior = await db.prepare('SELECT release_id,CAST(amount_atomic AS TEXT) amount_atomic,destination,reference FROM treasury_releases WHERE reference=?')
      .bind(body.reference).first<{release_id:string;amount_atomic:string;destination:string;reference:string}>();
    if (!prior) return null;
    if (BigInt(prior.amount_atomic) !== amount || (body.destination !== undefined && body.destination !== prior.destination)) {
      return json({error:'Release reference belongs to a different request'},409);
    }
    return json({ok:true,recorded:true,payment_executed:false,releaseId:prior.release_id,release:prior,duplicate:true});
  };
  const recovered = await recover();
  if (recovered) return recovered;
  // Read a revision before the snapshot. Every source/destination/release mutation
  // advances it; the conditional insert fails if anything changed in between.
  const revision = await db.prepare('SELECT version FROM treasury_revision WHERE id=1').first<{version:number}>();
  const {totals} = await balances(db);
  if (amount > totals.treasury) return await recover() || json({error:'Insufficient verified treasury balance',recorded:false},409);
  const releaseId = crypto.randomUUID();
  try {
    const result = await db.prepare(`INSERT INTO treasury_releases (release_id,amount_atomic,destination,reference)
      SELECT ?,?,destination,? FROM treasury_destination WHERE id=1
      AND (SELECT version FROM treasury_revision WHERE id=1)=?
      AND (? IS NULL OR destination=?)`).bind(releaseId,Number(amount),body.reference,revision?.version,body.destination ?? null,body.destination ?? null).run();
    if (!result.meta.changes) return await recover() || json({error:'Destination changed or ledger changed; retry or revise this release',recorded:false},409);
  } catch { return await recover() || json({error:'Ledger unavailable; retry with the same reference'},503); }
  return json({ok:true,recorded:true,payment_executed:false,releaseId});
}

const formatTotals = (totals: Record<string,bigint>) => Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,formatAtomicToUsdc(v)]));
// Ledger receipts may exceed the intake limit. Each on-chain amount is at most
// uint256; parsing text as BigInt keeps the full receipt and aggregate exact.
function parseLedgerAmount(value: string): bigint | null {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,77})(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}
async function balances(db: D1Database) {
  const totals: Record<string,bigint> = {treasury:0n,escrow:0n,reallocation:0n};
  const commitments = {...totals};
  // Never use SQLite SUM on atomic amounts: even valid individual int64
  // amounts can overflow in aggregate. BigInt also keeps commitments separate.
  const {results} = await db.prepare(`SELECT accounting_bucket,amount_usdc,1 funded FROM treasury_funding
    UNION ALL SELECT accounting_bucket,amount_usdc,0 funded FROM settlement_events
    WHERE rail='INTERNAL_LEDGER' AND accounting_bucket IN ('treasury','escrow','reallocation')`).all<{accounting_bucket:string;amount_usdc:string;funded:number}>();
  for (const row of results) {
    const amount = parseLedgerAmount(row.amount_usdc);
    if (amount === null) throw new Error('Invalid ledger amount; reconciliation required');
    (row.funded ? totals : commitments)[row.accounting_bucket] += amount;
  }
  const {results: releases} = await db.prepare('SELECT CAST(amount_atomic AS TEXT) amount_atomic FROM treasury_releases').all<{amount_atomic:string}>();
  for (const row of releases) totals.treasury -= BigInt(row.amount_atomic);
  return {totals,commitments};
}
