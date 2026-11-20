export interface OutputTierOption {
  id: string;
  tierLabel: string;
  priceUsdc: string;
  outputTitle: string;
  outputSlug: string;
  highlightSummary: string;
  researchNote: string;
  riskDisclosure: string;
  reinvestTarget: string;
  deliverableSummary: string;
}

/**
 * Approved output catalog shared by the UI and server. Prices are quoted and
 * validated server-side from this catalog; request bodies never set the price.
 */
export const OUTPUT_TIERS: readonly OutputTierOption[] = [
  {
    id: 'tier_free_0',
    tierLabel: 'Free Observation & Preview',
    priceUsdc: '0.000000',
    outputTitle: 'Highlight Clip & Research Abstract (Free Output)',
    outputSlug: 'sports_free_preview',
    highlightSummary: 'Free public MAX-INTERNET highlight & matchup overview.',
    researchNote: 'Introductory sports & research preview; no wallet or payment required.',
    riskDisclosure: '0.000000 USDC risked in preview mode; escrow state = untouched.',
    reinvestTarget: 'MAX-SPORTS',
    deliverableSummary: 'Free MAX-SPORTS observation preview. No payment or module access is included.',
  },
  {
    id: 'tier_std_5',
    tierLabel: 'Standard Output Tier',
    priceUsdc: '5.000000',
    outputTitle: 'Match Highlight & Research Output Brief',
    outputSlug: 'sports_standard_research_brief',
    highlightSummary: 'Key tactical moments, tempo markers, and highlight breakdown.',
    researchNote: 'Structured research output only — underlying modules remain internal.',
    riskDisclosure: 'Explicit opt-in Base USDC (8453) action required only if paying for output.',
    reinvestTarget: 'MAX-COMPUTE',
    deliverableSummary: 'Standard MAX-SPORTS highlight and research output brief.',
  },
  {
    id: 'tier_ext_15',
    tierLabel: 'Extended Output Tier',
    priceUsdc: '15.000000',
    outputTitle: 'Full Sports Prediction & Cross-Output Research Pack',
    outputSlug: 'sports_extended_research_pack',
    highlightSummary: 'Extended highlight timeline, risk/escrow breakdown, and research report.',
    researchNote: 'Delivers output report only; no raw modules or BEEMAX console access.',
    riskDisclosure: 'Review risk & escrow terms before opting in to Base USDC signing.',
    reinvestTarget: 'MAX-ECOSYSTEM',
    deliverableSummary: 'Extended MAX-SPORTS highlight timeline and cross-output research report.',
  },
];

export function getOutputTier(tierCode: string): OutputTierOption | undefined {
  return OUTPUT_TIERS.find((tier) => tier.id === tierCode);
}

/** Server-owned allocation for explicit opt-ins. */
export function settlementBucket(mode: string, tierCode?: string): 'treasury' | 'escrow' | 'reallocation' {
  if (['stake', 'wager', 'p2p'].includes(mode)) return 'escrow';
  return mode === 'paid-tier' && getOutputTier(tierCode || '')?.reinvestTarget === 'MAX-ECOSYSTEM' ? 'reallocation' : 'treasury';
}
