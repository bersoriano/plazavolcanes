import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, ShieldCheck, Sparkles, Store } from "lucide-react";

import { CatalogImage } from "@/components/catalog/catalog-image";
import type { CatalogShop } from "@/lib/queries/catalog.server";
import { formatShopLocation } from "@/lib/shop-location";
import { getTrustTierMarker } from "@/lib/trust-tiers";

/**
 * A shop in the plaza's row: a scroller item 300px wide on a phone, a grid
 * cell from lg up.
 */
export function PublicShopCard({ shop }: { shop: CatalogShop }) {
  const isPremium = shop.is_premium === true;
  const tier = getTrustTierMarker(shop.trust_tier);

  return (
    <Link
      className={`group flex w-[300px] max-w-[82vw] shrink-0 snap-start flex-col overflow-hidden rounded-[1.5rem] border bg-surface lg:w-auto lg:max-w-none lg:rounded-[1.75rem] ${
        isPremium ? "border-premium-gold" : "border-line"
      }`}
      href={`/tiendas/${shop.slug}`}
    >
      <div className="relative aspect-video overflow-hidden bg-photo-backdrop">
        {isPremium ? (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-premium-ink px-[9px] py-[5px] text-[11px] font-bold text-premium-gold shadow-sm lg:right-3.5 lg:top-3.5 lg:px-2.5 lg:py-1.5 lg:text-xs">
            <Sparkles aria-hidden="true" className="size-3" />
            Premium
          </span>
        ) : null}
        <CatalogImage
          alt=""
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          fallback={<div className="grid size-full place-items-center text-brand/35"><Store aria-hidden="true" className="size-9" /></div>}
          src={shop.imageUrl}
        />
      </div>
      <div className="flex flex-col gap-2.5 px-[18px] pb-5 pt-[18px] lg:gap-3 lg:px-6 lg:pb-6 lg:pt-[22px]">
        <div className="flex items-center justify-between gap-3">
          <h3
            className={`font-display text-[20px] font-semibold tracking-[-0.02em] lg:text-[23px] ${
              isPremium ? "text-premium-text" : "text-ink"
            }`}
          >
            {shop.name}
          </h3>
          <ArrowUpRight
            aria-hidden="true"
            className="hidden size-5 shrink-0 text-brand transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 lg:block"
          />
        </div>
        <div className="flex flex-col items-start gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-3 lg:gap-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-trust-tier-fill px-[9px] py-1 text-[12px] font-bold text-brand-hover lg:px-2.5 lg:py-[5px]">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Nivel {tier.label}
          </span>
          <span className="flex items-start gap-[5px] text-[13px] leading-[1.45] text-muted">
            <MapPin aria-hidden="true" className="mt-0.5 hidden size-3.5 shrink-0 lg:block" />
            {formatShopLocation(shop.country_code, shop.administrative_area_codes)}
          </span>
        </div>
        {shop.description ? (
          <p className="line-clamp-2 text-[14px] leading-[1.55] text-muted lg:text-[15px] lg:leading-[1.6]">
            {shop.description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * The last item of the shops row while the plaza is small: an open seat that
 * sends a would-be seller to the landing. A compact row under the scroller on
 * a phone, a full grid cell at lg.
 */
export function ShopInviteCard() {
  return (
    <Link
      className="mx-5 flex items-center gap-3.5 rounded-[1.25rem] border-2 border-dashed border-brand/25 px-[18px] py-4 text-ink transition-colors hover:border-brand/50 sm:mx-8 lg:mx-0 lg:flex-col lg:items-start lg:justify-center lg:gap-4 lg:rounded-[1.75rem] lg:p-9"
      href="/vender?desde=tiendas"
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-[0.8125rem] bg-brand text-accent lg:size-14 lg:rounded-2xl"
      >
        <Store className="size-[22px] lg:size-[26px]" strokeWidth={1.8} />
      </span>
      <span className="flex grow flex-col gap-0.5 lg:grow-0 lg:gap-4">
        <span className="font-display text-[17px] font-semibold lg:text-[26px] lg:leading-[1.1] lg:tracking-[-0.02em]">
          Tu tienda podría estar aquí
        </span>
        <span className="hidden text-[15px] leading-[1.6] text-muted lg:block">
          Abre tu tienda gratis y aparece en la plaza junto a quienes ya venden.
        </span>
        <span className="flex items-center gap-2 text-[14px] font-bold text-brand lg:min-h-11 lg:text-[16px] lg:underline lg:decoration-accent lg:decoration-[3px] lg:underline-offset-[5px]">
          Quiero vender
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2.2} />
        </span>
      </span>
    </Link>
  );
}
