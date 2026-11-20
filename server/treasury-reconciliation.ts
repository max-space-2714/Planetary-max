import { verifyBaseTransfer, type SettlementConfig, settlementConfigured } from './base-settlement';
import { formatAtomicToUsdc } from './verify-base-usdc';
/** Explicit AdminSessionDO-gated reconciliation of one historical artwork receipt. */
export async function reconcileArtworkFunding(request: Request, env: SettlementConfig & {DB:D1Database}) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) return Response.json({error:'Same origin required'},{status:403});
  const body = await request.json().catch(()=>null) as {txHash?:unknown} | null;
  if (!body || typeof body.txHash !== 'string' || !/^0x[\da-f]{64}$/i.test(body.txHash)) return Response.json({error:'Transaction hash required'},{status:400});
  const txHash=body.txHash.toLowerCase();
  const row=await env.DB.prepare('SELECT buyer_wallet FROM transactions WHERE lower(tx_reference)=?').bind(txHash).first<{buyer_wallet:string}>();
  if (!row) return Response.json({error:'Artwork transaction not found'},{status:404});
  if (!settlementConfigured(env)) return Response.json({error:'Historical receiving wallet/RPC configuration required'},{status:503});
  try {
    const check=await verifyBaseTransfer(env,txHash,row.buyer_wallet,0);
    if ('status' in check) return Response.json(check.body,{status:check.status});
    await env.DB.prepare('INSERT OR IGNORE INTO artwork_funding(tx_hash,amount_usdc) VALUES (?,?)').bind(txHash,formatAtomicToUsdc(BigInt(check.amountUnits))).run();
    return Response.json({ok:true,txHash,reconciled:true,payment_executed:false});
  } catch { return Response.json({error:'Receipt verification unavailable'},{status:503}); }
}
