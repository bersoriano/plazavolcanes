import { CircleHelp, ShieldCheck } from "lucide-react";

import { getTrustTierMarker, type TrustTier } from "@/lib/trust-tiers";

export function TrustTierBadge({
  tier,
  showDetails = true,
}: {
  tier: TrustTier;
  showDetails?: boolean;
}) {
  const marker = getTrustTierMarker(tier);

  return (
    <div className="group relative mt-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-accent/40 px-3 py-2 text-sm font-bold text-brand-hover">
      <ShieldCheck aria-hidden="true" className="size-4" />
      Nivel {marker.label}
      {showDetails ? <>
        <button
          aria-describedby="trust-tier-tooltip"
          aria-label="Más información sobre el nivel de confianza"
          className="tap-halo grid size-5 place-items-center rounded-full text-muted hover:text-brand"
          type="button"
        >
          <CircleHelp aria-hidden="true" className="size-3.5" />
        </button>
        <span
          className="pointer-events-none absolute left-0 top-[calc(100%+.5rem)] z-30 w-72 rounded-xl bg-brand-hover px-3 py-2 text-xs font-normal leading-5 text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          id="trust-tier-tooltip"
          role="tooltip"
        >
          {marker.tooltip}
        </span>
      </> : null}
    </div>
  );
}
