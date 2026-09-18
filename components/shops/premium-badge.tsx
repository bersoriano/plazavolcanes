import { Sparkles } from "lucide-react";

import { PREMIUM_ACCESSIBLE_NAME, PREMIUM_LABEL, PREMIUM_SUMMARY } from "@/lib/seller-standing";

/**
 * The mark of a shop Plaza Volcanes has distinguished.
 *
 * The badge carries no explanation of its own any more. What it means used to
 * hang off a hover tooltip, which a keyboard or a thumb could not reach and
 * which put the only statement of "granted, not measured" out of reach of the
 * people most likely to misread the badge. The explanation now travels beside
 * it as visible copy — see `PremiumNote` — and the badge keeps only the part
 * assistive technology needs to read it correctly.
 */
export function PremiumBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-premium-gold bg-premium-ink px-3 py-2 text-sm font-bold text-premium-gold ${className}`.trim()}
      data-testid="premium-badge"
    >
      <Sparkles aria-hidden="true" className="size-4" />
      {PREMIUM_LABEL}
      <span className="sr-only">
        {" "}
        — {PREMIUM_ACCESSIBLE_NAME}. {PREMIUM_SUMMARY}
      </span>
    </span>
  );
}
