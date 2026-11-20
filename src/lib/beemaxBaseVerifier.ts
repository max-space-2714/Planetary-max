export const BASE_CHAIN_ID = 8453;
export const BASE_NATIVE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const MAX_COMPUTE_VALUE = "0.000000";

export interface OptInUsdcSettlementRequest {
  optedIn: true;
  payerAddress: string;
  signature: `0x${string}`;
  domain:
    | "MAX-ART"
    | "MAX-GAMES"
    | "MAX-CHESS"
    | "MAX-SPORTS"
    | "MAX-MEDIA"
    | "MAX-SPACES";
  mode: "paid-tier" | "wager" | "p2p" | "storefront-order";
  amountUsdc: string;
  txHash: `0x${string}`;
}

export function rejectBlockedNamespace(value: string): boolean {
  return value.toUpperCase().includes("OPERATOR_NAMESPACE");
}

export async function requestOptInUsdcQuote(params: {
  optedIn: true;
  domain: OptInUsdcSettlementRequest["domain"];
  mode: OptInUsdcSettlementRequest["mode"];
  amountUsdc: string;
}) {
  if (params.optedIn !== true) throw new Error("Explicit Base USDC opt-in is required");
  if (rejectBlockedNamespace(params.domain)) {
    throw new Error("OPERATOR_NAMESPACE is not permitted");
  }
  const res = await fetch("/api/settlements/base-usdc/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...params,
      chainId: BASE_CHAIN_ID,
      usdcContract: BASE_NATIVE_USDC,
      maxCompute: MAX_COMPUTE_VALUE,
    }),
  });
  if (!res.ok) {
    throw new Error("Failed to create opt-in Base USDC quote");
  }
  return res.json();
}

export async function verifyOptInUsdcSettlement(
  payload: OptInUsdcSettlementRequest
) {
  if (rejectBlockedNamespace(payload.domain)) {
    throw new Error("OPERATOR_NAMESPACE is not permitted");
  }
  if (payload.optedIn !== true) {
    throw new Error("Explicit Base USDC opt-in is required");
  }
  const res = await fetch("/api/settlements/base-usdc/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      chainId: BASE_CHAIN_ID,
      usdcContract: BASE_NATIVE_USDC,
      maxCompute: MAX_COMPUTE_VALUE,
    }),
  });
  if (!res.ok) {
    throw new Error("Base USDC settlement verification failed");
  }
  return res.json();
}
