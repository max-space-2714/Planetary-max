import { settlementBucket } from './outputTiers';
export function baseUsdcSettlementMessage(origin: string, input: {
  domain: string; mode: string; tierCode?: string; amountUsdc: string; txHash: string; payerAddress: string;
}): string {
  return `BEEMAX Base USDC settlement proof v2\nOrigin: ${origin}\nChain: 8453\nDomain: ${input.domain}\nMode: ${input.mode}\nTier: ${input.tierCode || ''}\nAllocation: ${settlementBucket(input.mode, input.tierCode)}\nAmount: ${input.amountUsdc}\nTransaction: ${input.txHash.trim().toLowerCase()}\nPayer: ${input.payerAddress.trim().toLowerCase()}`;
}
