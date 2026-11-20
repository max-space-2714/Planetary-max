import { getOutputTier, settlementBucket } from '../src/shared/outputTiers';
import { encodeFunctionData, erc20Abi, verifyMessage } from 'viem';
import { HUB_MODULES } from '../src/shared/hubModules';
import { verifyBaseTransfer } from './base-settlement';
import { parseUsdcToAtomic, formatAtomicToUsdc } from './verify-base-usdc';
import { baseUsdcSettlementMessage } from '../src/shared/baseUsdcSettlementMessage';

export interface SettlementEnv {
  DB: D1Database;
  RPC_URL?: string;
  SETTLEMENT_RECIPIENT_ADDRESS?: string;
}
export const BASE_CHAIN_ID = 8453;
export const BASE_NATIVE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ADDRESS = /^0x[\da-fA-F]{40}$/;
const HASH = /^0x[\da-fA-F]{64}$/;
const DOMAINS = ['MAX-ART', 'MAX-GAMES', 'MAX-CHESS', 'MAX-SPORTS', 'MAX-MEDIA', 'MAX-SPACES', ...HUB_MODULES.map(module => module.domain)];
const MODES = ['paid-tier', 'wager', 'p2p', 'storefront-order', 'stake'];
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export function parseUsdcToBaseUnits(amountUsdc: string): bigint | null {
  return typeof amountUsdc === 'string' ? parseUsdcToAtomic(amountUsdc.trim()) : null;
}

// Reuse the existing single-log verifier, including RPC chain and confirmation checks.
export async function verifyBaseUsdcTransferReceipt(params: {
  rpcUrl: string; txHash: string; expectedPayer: string; expectedRecipient: string; expectedAmountBaseUnits: bigint;
}): Promise<{ verified: boolean; reason?: string; amountUnits?: string }> {
  if (!HASH.test(params.txHash) || !ADDRESS.test(params.expectedPayer) || !ADDRESS.test(params.expectedRecipient) || params.expectedAmountBaseUnits <= 0n) {
    return { verified: false, reason: 'Invalid receipt verification parameters' };
  }
  try {
    const check = await verifyBaseTransfer({ RPC_URL: params.rpcUrl, USDC_CONTRACT: BASE_NATIVE_USDC, TREASURY_WALLET: params.expectedRecipient }, params.txHash.toLowerCase(), params.expectedPayer, 0, params.expectedAmountBaseUnits.toString());
    if ('status' in check) return { verified: false, reason: check.body.error || check.body.message || 'Receipt not confirmed' };
    return { verified: true, amountUnits: check.amountUnits };
  } catch { return { verified: false, reason: 'Base receipt verification unavailable or malformed RPC response' }; }
}

type Input = Record<string, unknown>;
async function readInput(request: Request): Promise<Input | Response> {
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  const url = new URL(request.url);
  if ([...url.searchParams.getAll('namespace'), request.headers.get('x-target-namespace')].some(blocked)) return json({ ok: false, error: 'OPERATOR_NAMESPACE is not permitted' }, 403);
  if (request.headers.get('Origin') !== url.origin) return json({ ok: false, error: 'A same-origin request is required' }, 403);
  if (Number(request.headers.get('Content-Length')) > 16_384) return json({ ok: false, error: 'Request too large' }, 413);
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16_384) return json({ ok: false, error: 'Request too large' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ ok: false, error: 'Invalid JSON body' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'Invalid JSON object' }, 400);
  const input = body as Input;
  if (Object.values(input).some(blocked)) return json({ ok: false, error: 'OPERATOR_NAMESPACE is not permitted' }, 403);
  if (input.optedIn !== true) return json({ ok: false, error: 'Explicit opt-in required for Base USDC' }, 400);
  if (input.chainId !== undefined && input.chainId !== BASE_CHAIN_ID) return json({ ok: false, error: 'Only Base Mainnet (8453) is supported' }, 400);
  if (input.usdcContract !== undefined && (typeof input.usdcContract !== 'string' || input.usdcContract.toLowerCase() !== BASE_NATIVE_USDC.toLowerCase())) return json({ ok: false, error: 'Only native Base USDC is supported' }, 400);
  if (input.maxCompute !== undefined && input.maxCompute !== '0.000000') return json({ ok: false, error: 'MAX Compute must remain 0.000000' }, 400);
  input.domain ??= 'MAX-SPACES'; input.mode ??= 'paid-tier';
  if (!DOMAINS.includes(input.domain as string) || !MODES.includes(input.mode as string)) return json({ ok: false, error: 'Invalid domain or mode' }, 400);
  if (input.bucket !== undefined && !['treasury', 'escrow', 'reallocation'].includes(input.bucket as string)) return json({ ok: false, error: 'Invalid ledger bucket' }, 400);
  const amount = typeof input.amountUsdc === 'string' ? parseUsdcToBaseUnits(input.amountUsdc) : null;
  if (amount === null || amount <= 0n) return json({ ok: false, error: 'Invalid amountUsdc' }, 400);
  input.amountUsdc = formatAtomicToUsdc(amount);
  if (input.mode === 'paid-tier') {
    const tier = typeof input.tierCode === 'string' ? getOutputTier(input.tierCode) : undefined;
    if (!tier || tier.priceUsdc === '0.000000' || tier.priceUsdc !== input.amountUsdc) return json({ok:false,error:'Select an approved paid tier at its catalog price'},400);
  } else if (input.tierCode !== undefined) return json({ok:false,error:'Tier applies only to paid-tier requests'},400);
  if (input.bucket !== undefined && input.bucket !== bucketFor(input)) return json({ok:false,error:'Allocation is controlled by server policy'},400);
  return input;
}
function blocked(value: unknown): boolean { return typeof value === 'string' && value.toUpperCase().includes('OPERATOR_NAMESPACE'); }
const constants = { chainId: BASE_CHAIN_ID, usdcContract: BASE_NATIVE_USDC, maxCompute: '0.000000' };
async function settlementRecipient(env?: SettlementEnv): Promise<string> {
  const configured = env?.SETTLEMENT_RECIPIENT_ADDRESS?.trim();
  const saved = env && !configured ? await env.DB.prepare('SELECT destination FROM treasury_destination WHERE id=1').first<{destination:string}>() : null;
  return (configured || saved?.destination || '').trim().toLowerCase();
}
export async function handleBaseUsdcQuoteRoute(request: Request, env?: SettlementEnv): Promise<Response> {
  const body = await readInput(request);
  if (body instanceof Response) return body;
  const recipient = await settlementRecipient(env);
  const payment = ADDRESS.test(recipient) && recipient !== `0x${'0'.repeat(40)}` ? {
    recipient, to: BASE_NATIVE_USDC, value: '0x0',
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient as `0x${string}`, parseUsdcToBaseUnits(body.amountUsdc as string)!] }),
  } : null;
  return json({ ok: true, payment, ...constants, quoteId: crypto.randomUUID(), domain: body.domain, mode: body.mode, amountUsdc: body.amountUsdc, amountBaseUnits: parseUsdcToBaseUnits(body.amountUsdc as string)!.toString() });
}
export async function handleBaseUsdcVerifyRoute(request: Request, env: SettlementEnv): Promise<Response> {
  const body = await readInput(request);
  if (body instanceof Response) return body;
  if (body.txHash === undefined && body.payerAddress === undefined && body.signature === undefined) {
    return recordInternalOrder(body, env);
  }
  const txHash = typeof body.txHash === 'string' ? body.txHash.trim().toLowerCase() : '';
  const payer = typeof body.payerAddress === 'string' ? body.payerAddress.trim().toLowerCase() : '';
  if (!HASH.test(txHash) || !ADDRESS.test(payer)) return json({ ok: false, error: 'Invalid txHash or payerAddress' }, 400);
  if (body.tenantId !== undefined && body.tenantId !== payer) return json({ ok: false, error: 'Tenant must match the proving payer wallet' }, 403);
  const recipient = await settlementRecipient(env);
  if (!ADDRESS.test(recipient)) return json({ ok: false, error: 'Settlement recipient not configured' }, 503);
  if (typeof body.signature !== 'string' || !/^0x[\da-fA-F]{130}$/.test(body.signature)) return json({ ok: false, error: 'Payer signature required' }, 400);
  const domain = body.domain as string, mode = body.mode as string, amount = body.amountUsdc as string;
  try {
    if (!await verifyMessage({ address: payer as `0x${string}`, signature: body.signature as `0x${string}`, message: baseUsdcSettlementMessage(new URL(request.url).origin, { domain, mode, tierCode: body.tierCode as string | undefined, amountUsdc: amount, txHash, payerAddress: payer }) })) return json({ ok: false, error: 'Invalid payer signature' }, 403);
  } catch { return json({ ok: false, error: 'Invalid payer signature' }, 403); }
  const check = await verifyBaseUsdcTransferReceipt({ rpcUrl: env.RPC_URL || 'https://mainnet.base.org', txHash, expectedPayer: payer, expectedRecipient: recipient, expectedAmountBaseUnits: parseUsdcToBaseUnits(amount)! });
  if (!check.verified) return json({ ok: false, verified: false, error: check.reason }, 422);
  const orderId = typeof body.orderId === 'string' ? body.orderId : crypto.randomUUID(), eventId = crypto.randomUUID();
  if (body.orderId !== undefined) {
    const existing = await env.DB.prepare('SELECT * FROM output_orders WHERE order_id = ? AND intake_key = ?').bind(orderId, typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '').first<Record<string, string>>();
    if (!existing || existing.price_usdc !== amount || existing.output_title !== `${domain} ${mode} transfer` || existing.tx_hash || existing.tier_code !== (body.tierCode || '')) return json({ ok: false, error: 'Order does not match receipt context' }, 409);
    const allocation = await env.DB.prepare('SELECT accounting_bucket FROM settlement_events WHERE order_id=?').bind(orderId).first<{accounting_bucket:string}>();
    if (allocation?.accounting_bucket !== bucketFor(body)) return json({ok:false,error:'Order allocation requires reconciliation'},409);
    try {
      const updated = await env.DB.batch([
        env.DB.prepare(`UPDATE output_orders SET tx_hash=?, payer_address=?, recipient_address=?, tenant_id=?, order_status='settlement_verified', settlement_status='verified_settlement', verified_at=datetime('now') WHERE order_id=? AND tx_hash=''`).bind(txHash, payer, recipient, payer, orderId),
        env.DB.prepare(`UPDATE settlement_events SET tx_hash=?, from_address=?, to_address=?, rail='BASE_USDC', verified_amount_usdc=?, amount_usdc=? WHERE order_id=? AND rail='INTERNAL_LEDGER' AND EXISTS (SELECT 1 FROM output_orders WHERE order_id=? AND tx_hash=?)`).bind(txHash, payer, recipient, formatAtomicToUsdc(BigInt(check.amountUnits!)), formatAtomicToUsdc(BigInt(check.amountUnits!)), orderId, orderId, txHash),
      ]);
      if (!updated[0].meta.changes) return json({ok:false,error:'Order already verified'},409);
    } catch { return json({ ok: false, error: 'Receipt already claimed' }, 409); }
    return json({ ok: true, verified: true, ...constants, orderId, txHash, delivery_status: 'locked' });
  }
  const verifiedAmount = formatAtomicToUsdc(BigInt(check.amountUnits!));
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO output_orders (order_id,tier_code,output_slug,output_title,tier_name,price_usdc,delivery_mode,reinvest_target,settlement_mode,tenant_id,quoted_price_usdc,order_status,settlement_status,tx_hash,payer_address,recipient_address,delivery_status,verified_at)
        VALUES (?,?,?,?,?,?,'OUTPUT_ONLY_NO_MODULE',?,'BASE_USDC_OPT_IN',?,?,'settlement_verified','verified_settlement',?,?,?,'locked',datetime('now'))`).bind(orderId, body.tierCode || '', getOutputTier(body.tierCode as string)?.outputSlug || '', `${domain} ${mode} transfer`, mode, amount, domain, payer, amount, txHash, payer, recipient),
      env.DB.prepare(`INSERT INTO settlement_events (event_id,tx_hash,chain_id,rail,source_kind,from_address,to_address,amount_usdc,order_id,token_contract,verified_amount_usdc,accounting_bucket)
        VALUES (?,?,8453,'BASE_USDC','output_order',?,?,?,?,?,?,?)`).bind(eventId, txHash, payer, recipient, verifiedAmount, orderId, BASE_NATIVE_USDC, verifiedAmount, bucketFor(body)),
    ]);
  } catch { return json({ ok: false, verified: false, error: 'Receipt already claimed or settlement could not be recorded' }, 409); }
  return json({ ok: true, verified: true, ...constants, orderId, eventId, txHash, delivery_status: 'locked' });
}

function bucketFor(body: Input): string {
  return settlementBucket(body.mode as string, body.tierCode as string | undefined);
}
async function recordInternalOrder(body: Input, env: SettlementEnv): Promise<Response> {
  const key = body.idempotencyKey;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(key)) return json({ ok: false, error: 'A random idempotencyKey of 32–128 characters is required' }, 400);
  const bucket = bucketFor(body), orderId = crypto.randomUUID(), eventId = crypto.randomUUID();
  const title = `${body.domain} ${body.mode} transfer`;
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO output_orders (order_id,tier_code,output_slug,output_title,tier_name,price_usdc,quoted_price_usdc,delivery_mode,reinvest_target,settlement_mode,order_status,settlement_status,intake_key)
        VALUES (?,?,?,?,?,?,?,'OUTPUT_ONLY_NO_MODULE',?,'INTERNAL_OPT_IN','recorded','unverified_internal',?)`).bind(orderId,body.tierCode || '',getOutputTier(body.tierCode as string)?.outputSlug || '',title,body.mode,body.amountUsdc,body.amountUsdc,body.domain,key),
      env.DB.prepare(`INSERT INTO settlement_events (event_id,tx_hash,rail,source_kind,to_address,amount_usdc,order_id,accounting_bucket,escrow_status)
        VALUES (?,?,'INTERNAL_LEDGER','output_order','',?,?,?,?)`).bind(eventId,`internal:${orderId}`,body.amountUsdc,orderId,bucket,bucket === 'escrow' ? 'pending' : 'settled'),
    ]);
  } catch {
    const prior = await env.DB.prepare(`SELECT o.order_id,o.tier_code,o.output_title,o.price_usdc,e.accounting_bucket FROM output_orders o JOIN settlement_events e ON e.order_id=o.order_id WHERE o.intake_key=?`).bind(key).first<Record<string,string>>();
    if (!prior || prior.tier_code !== (body.tierCode || '') || prior.output_title !== title || prior.price_usdc !== body.amountUsdc || prior.accounting_bucket !== bucket) return json({ ok:false,error:'Order conflict or ledger unavailable' },409);
    return json({ok:true,verified:false,...constants,orderId:prior.order_id,bucket,duplicate:true,delivery_status:'locked'});
  }
  return json({ok:true,verified:false,...constants,orderId,eventId,bucket,delivery_status:'locked',financial_note:'Internal bookkeeping only; no payment verified or moved.'});
}
