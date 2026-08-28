import Link from "next/link";
import { Store } from "lucide-react";

import type { PublicTrustMetrics } from "@/lib/public-trust";
import { TrustBadges } from "@/components/shops/trust-badges";
import { TrustTierBadge } from "@/components/shops/trust-tier-badge";

/** Who the buyer is asking, and what the plaza knows about them. */
export function ShopPanel({
  shop,
}: {
  shop: {
    name: string;
    slug: string;
    imageUrl: string | null;
    trustTier: "standard" | "reliable" | "top_rated";
    trustMetrics: PublicTrustMetrics | null;
    trustProfile: { joinedOn: string } | null;
    sellerDisplayName: string;
    location: string;
  };
}) {
  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Vendedor</p>

      <div className="mt-4 flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#eee8e1]">
          {shop.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img alt={shop.name} className="size-full object-cover" src={shop.imageUrl} />
          ) : (
            <Store aria-hidden="true" className="size-6 text-brand/40" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{shop.sellerDisplayName}</p>
          <p className="truncate font-display text-xl font-semibold">{shop.name}</p>
          <p className="text-sm text-muted">{shop.location}</p>
        </div>
      </div>

      <div className="mt-4">
        <TrustTierBadge tier={shop.trustTier} />
      </div>

      <div className="mt-4">
        <TrustBadges metrics={shop.trustMetrics} profile={shop.trustProfile} />
      </div>

      <Link className="mt-5 inline-flex text-sm font-semibold text-brand" href={`/tiendas/${shop.slug}`}>
        Ver la tienda
      </Link>
    </div>
  );
}
