import { FounderMark } from "@/components/shops/founder-mark";
import { FOUNDERS_CAP, FOUNDER_MIN_LIVE_ITEMS, FOUNDER_QUALIFY_DAYS } from "@/lib/launch";

/**
 * The permanent mark of a founding shop, in the gold-on-ink the cards use.
 * Its label says how it was earned, so a buyer knows it is not bought.
 */
export function FounderBadge({ className = "" }: { className?: string }) {
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full border border-premium-gold bg-premium-ink px-3 py-2 text-sm font-bold text-premium-gold ${className}`.trim()}
      title={`Una de las primeras ${FOUNDERS_CAP} tiendas de Plaza Volcanes: publicó ${FOUNDER_MIN_LIVE_ITEMS} productos en sus primeros ${FOUNDER_QUALIFY_DAYS} días.`}
    >
      <FounderMark className="size-4" />
      Tienda fundadora
    </p>
  );
}
