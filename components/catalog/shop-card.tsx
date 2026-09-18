import Link from "next/link";
import { ArrowUpRight, MapPin, Sparkles, Store } from "lucide-react";

import { CatalogImage } from "@/components/catalog/catalog-image";
import { ReputationBadge } from "@/components/shops/reputation-badge";
import type { CatalogShop } from "@/lib/queries/catalog.server";
import { PREMIUM_LABEL, PREMIUM_SUMMARY } from "@/lib/seller-standing";
import { formatShopLocation } from "@/lib/shop-location";

export function PublicShopCard({ shop }: { shop: CatalogShop }) {
  const isPremium = shop.is_premium === true;

  return (
    <Link
      className={`group min-w-[260px] flex-1 overflow-hidden rounded-[1.5rem] border bg-surface ${
        isPremium ? "border-premium-gold" : "border-line"
      }`}
      href={`/tiendas/${shop.slug}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-photo-backdrop">
        {isPremium ? (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-premium-ink px-2.5 py-1.5 text-xs font-bold text-premium-gold shadow-sm">
            <Sparkles aria-hidden="true" className="size-3" />
            {PREMIUM_LABEL}
          </span>
        ) : null}
        <CatalogImage
          alt=""
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          fallback={<div className="grid size-full place-items-center text-brand/35"><Store aria-hidden="true" className="size-9" /></div>}
          src={shop.imageUrl}
        />
      </div>
      <div className="flex items-start justify-between gap-4 p-5"><div><div className="flex flex-wrap items-center gap-2"><h3 className={`font-display text-xl font-semibold tracking-[-0.02em]${isPremium ? " text-premium-text" : ""}`}>{shop.name}</h3><ReputationBadge tier={shop.trust_tier} /></div><p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted"><MapPin aria-hidden="true" className="size-3.5" />{formatShopLocation(shop.country_code, shop.administrative_area_codes)}</p>{isPremium ? <p className="mt-1 text-xs font-semibold text-muted">{PREMIUM_SUMMARY}</p> : null}<p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{shop.description}</p></div><ArrowUpRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-brand transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
    </Link>
  );
}
