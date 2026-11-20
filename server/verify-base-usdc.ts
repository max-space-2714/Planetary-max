const BASE_MAINNET_CHAIN_ID = 8453;
const CANONICAL_BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface VerifyBaseUsdcInput {
  rpcUrl: string;
  txHash: string;
  expectedRecipient: string;
  expectedAmountUsdc: string;
  expectedSender?: string;
  expectedContract?: string;
  expectedChainId?: number;
}

export interface VerifyBaseUsdcOutput {
  verified: boolean;
  reason?: string;
  txHash: string;
  chainId: number;
  contract: string;
  fromAddress?: string;
  toAddress?: string;
  matchedAmountUsdc?: string;
  blockNumber?: string;
}

export function parseUsdcToAtomic(amount: string): bigint | null {
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(amount)) return null;
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

export function formatAtomicToUsdc(amount: bigint): string {
  if (amount < 0n) return `-${formatAtomicToUsdc(-amount)}`;
  return `${amount / 1_000_000n}.${(amount % 1_000_000n).toString().padStart(6, '0')}`;
}

function addressFromTopic(topic: string): string | null {
  if (!/^0x[\da-fA-F]{64}$/.test(topic)) return null;
  return `0x${topic.slice(-40).toLowerCase()}`;
}

async function jsonRpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Base RPC HTTP ${response.status}`);
  const payload = await response.json() as { result?: T; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message || 'Base RPC error');
  return payload.result as T;
}

export async function verifyBaseUsdcTransfer(input: VerifyBaseUsdcInput): Promise<VerifyBaseUsdcOutput> {
  const expectedChainId = input.expectedChainId ?? BASE_MAINNET_CHAIN_ID;
  const expectedContract = (input.expectedContract || CANONICAL_BASE_USDC).toLowerCase();
  const recipient = input.expectedRecipient.trim().toLowerCase();
  const sender = input.expectedSender?.trim().toLowerCase();
  const baseResult = { txHash: input.txHash.toLowerCase(), chainId: expectedChainId, contract: expectedContract };
  if (!/^0x[\da-fA-F]{64}$/.test(input.txHash)) return { ...baseResult, verified: false, reason: 'Invalid transaction hash format' };
  if (!/^0x[\da-f]{40}$/.test(recipient) || !/^0x[\da-f]{40}$/.test(expectedContract)) return { ...baseResult, verified: false, reason: 'Invalid recipient or token contract address' };
  if (expectedContract !== CANONICAL_BASE_USDC) return { ...baseResult, verified: false, reason: 'Token contract is not canonical Base USDC' };
  if (sender && !/^0x[\da-f]{40}$/.test(sender)) return { ...baseResult, verified: false, reason: 'Invalid expected sender address' };
  const required = parseUsdcToAtomic(input.expectedAmountUsdc);
  if (required === null || required <= 0n) return { ...baseResult, verified: false, reason: 'Invalid server-quoted USDC amount' };

  const chainHex = await jsonRpc<string>(input.rpcUrl, 'eth_chainId', []);
  const chainId = Number.parseInt(chainHex, 16);
  if (!Number.isSafeInteger(chainId) || chainId !== expectedChainId || chainId !== BASE_MAINNET_CHAIN_ID) {
    return { ...baseResult, verified: false, chainId, reason: `Wrong network: expected Base chain ${BASE_MAINNET_CHAIN_ID}, got ${chainId}` };
  }
  const receipt = await jsonRpc<{
    status?: string;
    blockNumber?: string;
    logs?: Array<{ address?: string; topics?: string[]; data?: string }>;
  } | null>(input.rpcUrl, 'eth_getTransactionReceipt', [input.txHash.toLowerCase()]);
  if (!receipt) return { ...baseResult, chainId, verified: false, reason: 'Receipt not found or transaction is pending' };
  if (receipt.status !== '0x1') return { ...baseResult, chainId, verified: false, reason: 'Transaction failed or reverted' };
  if (!receipt.blockNumber || !/^0x[\da-fA-F]+$/.test(receipt.blockNumber)) return { ...baseResult, chainId, verified: false, reason: 'Receipt has an invalid block number' };

  let total = 0n;
  let matchedSender: string | undefined;
  for (const log of receipt.logs ?? []) {
    if (log.address?.toLowerCase() !== expectedContract || !log.topics || log.topics.length < 3) continue;
    if (log.topics[0]?.toLowerCase() !== TRANSFER_EVENT_TOPIC) continue;
    if (!/^0x[\da-fA-F]{64}$/.test(log.topics[2]) || `0x${log.topics[2].slice(-40).toLowerCase()}` !== recipient) continue;
    const logSender = addressFromTopic(log.topics[1]);
    if (!logSender || (sender && logSender !== sender) || !log.data || !/^0x[\da-fA-F]+$/.test(log.data)) continue;
    let amount: bigint;
    try { amount = BigInt(log.data); } catch { continue; }
    if (amount <= 0n) continue;
    total += amount;
    matchedSender = logSender;
  }
  if (total < required) {
    return { ...baseResult, chainId, verified: false, reason: `Insufficient matching Base USDC transfer: required ${formatAtomicToUsdc(required)}, found ${formatAtomicToUsdc(total)}`, toAddress: recipient, fromAddress: matchedSender, matchedAmountUsdc: formatAtomicToUsdc(total), blockNumber: receipt.blockNumber };
  }
  return { ...baseResult, chainId, verified: true, fromAddress: matchedSender, toAddress: recipient, matchedAmountUsdc: formatAtomicToUsdc(total), blockNumber: receipt.blockNumber };
}
