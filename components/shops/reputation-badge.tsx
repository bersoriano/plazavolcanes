import { ShieldCheck } from "lucide-react";

import {
  publicReputationTier,
  REPUTATION_TIER_EXPLANATIONS,
  REPUTATION_TIER_LABELS,
} from "@/lib/seller-standing";
import type { TrustTier } from "@/lib/trust-tiers";

/**
 * The tier a shop earned, when it earned one.
 *
 * `standard` renders nothing: it is where every shop begins, so shown in
 * public beside the Premium badge it read as a second, contradicting rank
 * rather than as information. The tier keeps governing listing limits and
 * still appears in the seller's own panel; only the buyer-facing label goes.
 */
export function ReputationBadge({ tier, className = "" }: { tier: TrustTier; className?: string }) {
  const earned = publicReputationTier(tier);
  if (!earned) return null;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-brand/20 bg-trust-tier-fill px-3 py-2 text-sm font-bold text-brand-hover ${className}`.trim()}
      data-testid="reputation-badge"
    >
      <ShieldCheck aria-hidden="true" className="size-4" />
      {REPUTATION_TIER_LABELS[earned]}
      <span className="sr-only"> — {REPUTATION_TIER_EXPLANATIONS[earned]}</span>
    </span>
  );
}
