import { verifyMessage } from 'viem';
import { verifyBaseTransfer } from './base-settlement';
import { parseUsdcToAtomic, formatAtomicToUsdc } from './verify-base-usdc';
import { baseUsdcSettlementMessage } from '../src/shared/baseUsdcSettlementMessage';

export interface SettlementEnv {
  DB: D1Database;
  RPC_URL?: string;
  SETTLEMENT_RECIPIENT_ADDRESS: string;
}
export const BASE_CHAIN_ID = 8453;
export const BASE_NATIVE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ADDRESS = /^0x[\da-fA-F]{40}$/;
const HASH = /^0x[\da-fA-F]{64}$/;
const DOMAINS = ['MAX-ART', 'MAX-GAMES', 'MAX-CHESS', 'MAX-SPORTS', 'MAX-MEDIA', 'MAX-SPACES'];
const MODES = ['paid-tier', 'wager', 'p2p', 'storefront-order'];
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
  if ([url.searchParams.get('namespace'), request.headers.get('x-target-namespace')].some(blocked)) return json({ ok: false, error: 'OPERATOR_NAMESPACE is not permitted' }, 403);
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
  if (input.chainId !== BASE_CHAIN_ID) return json({ ok: false, error: 'Only Base Mainnet (8453) is supported' }, 400);
  if (input.usdcContract !== undefined && (typeof input.usdcContract !== 'string' || input.usdcContract.toLowerCase() !== BASE_NATIVE_USDC.toLowerCase())) return json({ ok: false, error: 'Only native Base USDC is supported' }, 400);
  if (input.maxCompute !== undefined && input.maxCompute !== '0.000000') return json({ ok: false, error: 'MAX Compute must remain 0.000000' }, 400);
  input.domain ??= 'MAX-SPACES'; input.mode ??= 'paid-tier';
  if (!DOMAINS.includes(input.domain as string) || !MODES.includes(input.mode as string)) return json({ ok: false, error: 'Invalid domain or mode' }, 400);
  const amount = typeof input.amountUsdc === 'string' ? parseUsdcToBaseUnits(input.amountUsdc) : null;
  if (amount === null || amount <= 0n) return json({ ok: false, error: 'Invalid amountUsdc' }, 400);
  input.amountUsdc = formatAtomicToUsdc(amount);
  return input;
}
function blocked(value: unknown): boolean { return typeof value === 'string' && value.toUpperCase().includes('OPERATOR_NAMESPACE'); }
const constants = { chainId: BASE_CHAIN_ID, usdcContract: BASE_NATIVE_USDC, maxCompute: '0.000000' };
export async function handleBaseUsdcQuoteRoute(request: Request): Promise<Response> {
  const body = await readInput(request);
  if (body instanceof Response) return body;
  return json({ ok: true, ...constants, quoteId: crypto.randomUUID(), domain: body.domain, mode: body.mode, amountUsdc: body.amountUsdc, amountBaseUnits: parseUsdcToBaseUnits(body.amountUsdc as string)!.toString() });
}
export async function handleBaseUsdcVerifyRoute(request: Request, env: SettlementEnv): Promise<Response> {
  const body = await readInput(request);
  if (body instanceof Response) return body;
  const txHash = typeof body.txHash === 'string' ? body.txHash.trim().toLowerCase() : '';
  const payer = typeof body.payerAddress === 'string' ? body.payerAddress.trim().toLowerCase() : '';
  if (!HASH.test(txHash) || !ADDRESS.test(payer)) return json({ ok: false, error: 'Invalid txHash or payerAddress' }, 400);
  if (body.tenantId !== undefined && body.tenantId !== payer) return json({ ok: false, error: 'Tenant must match the proving payer wallet' }, 403);
  const recipient = env.SETTLEMENT_RECIPIENT_ADDRESS?.trim().toLowerCase() || '';
  if (!ADDRESS.test(recipient)) return json({ ok: false, error: 'Settlement recipient not configured' }, 503);
  if (typeof body.signature !== 'string' || !/^0x[\da-fA-F]{130}$/.test(body.signature)) return json({ ok: false, error: 'Payer signature required' }, 400);
  const domain = body.domain as string, mode = body.mode as string, amount = body.amountUsdc as string;
  try {
    if (!await verifyMessage({ address: payer as `0x${string}`, signature: body.signature as `0x${string}`, message: baseUsdcSettlementMessage(new URL(request.url).origin, { domain, mode, amountUsdc: amount, txHash, payerAddress: payer }) })) return json({ ok: false, error: 'Invalid payer signature' }, 403);
  } catch { return json({ ok: false, error: 'Invalid payer signature' }, 403); }
  const check = await verifyBaseUsdcTransferReceipt({ rpcUrl: env.RPC_URL || 'https://mainnet.base.org', txHash, expectedPayer: payer, expectedRecipient: recipient, expectedAmountBaseUnits: parseUsdcToBaseUnits(amount)! });
  if (!check.verified) return json({ ok: false, verified: false, error: check.reason }, 422);
  const orderId = crypto.randomUUID(), eventId = crypto.randomUUID();
  const verifiedAmount = formatAtomicToUsdc(BigInt(check.amountUnits!));
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO output_orders (order_id,output_title,tier_name,price_usdc,delivery_mode,reinvest_target,settlement_mode,tenant_id,quoted_price_usdc,order_status,settlement_status,tx_hash,payer_address,recipient_address,delivery_status,verified_at)
        VALUES (?,?,?,?,'OUTPUT_ONLY_NO_MODULE',?,'BASE_USDC_OPT_IN',?,?,'settlement_verified','verified_settlement',?,?,?,'locked',datetime('now'))`).bind(orderId, `${domain} ${mode} transfer`, mode, amount, domain, payer, amount, txHash, payer, recipient),
      env.DB.prepare(`INSERT INTO settlement_events (event_id,tx_hash,chain_id,rail,source_kind,from_address,to_address,amount_usdc,order_id,token_contract,verified_amount_usdc)
        VALUES (?,?,8453,'BASE_USDC','output_order',?,?,?,?,?,?)`).bind(eventId, txHash, payer, recipient, verifiedAmount, orderId, BASE_NATIVE_USDC, verifiedAmount),
    ]);
  } catch { return json({ ok: false, verified: false, error: 'Receipt already claimed or settlement could not be recorded' }, 409); }
  return json({ ok: true, verified: true, ...constants, orderId, eventId, txHash, delivery_status: 'locked' });
}
