export function baseUsdcSettlementMessage(origin: string, input: {
  domain: string; mode: string; amountUsdc: string; txHash: string; payerAddress: string;
}): string {
  return `BEEMAX Base USDC settlement proof\nOrigin: ${origin}\nChain: 8453\nDomain: ${input.domain}\nMode: ${input.mode}\nAmount: ${input.amountUsdc}\nTransaction: ${input.txHash.trim().toLowerCase()}\nPayer: ${input.payerAddress.trim().toLowerCase()}`;
}
