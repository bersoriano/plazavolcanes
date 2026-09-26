import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, Plus, ShieldCheck, Sparkles, Store } from "lucide-react";

import { CatalogImage } from "@/components/catalog/catalog-image";
import type { CatalogShop } from "@/lib/queries/catalog.server";
import { formatShopLocation } from "@/lib/shop-location";
import { getTrustTierMarker } from "@/lib/trust-tiers";

/**
 * A shop in the plaza's row: a scroller item 300px wide on a phone, a grid
 * cell from lg up. A shop without a cover photo gets a tinted panel; `tint`
 * lets a row alternate them so neighbouring cards do not blur together.
 */
export function PublicShopCard({
  shop,
  tint = "lilac",
  className = "",
}: {
  shop: CatalogShop;
  tint?: "lilac" | "gold";
  className?: string;
}) {
  const isPremium = shop.is_premium === true;
  const tier = getTrustTierMarker(shop.trust_tier);

  return (
    <Link
      className={`group flex w-[300px] max-w-[82vw] shrink-0 snap-start flex-col overflow-hidden rounded-[26px] border bg-surface lg:w-auto lg:max-w-none lg:rounded-[32px] ${
        isPremium ? "border-premium-gold" : "border-line"
      } ${className}`}
      href={`/tiendas/${shop.slug}`}
    >
      <div
        className={`relative h-[170px] shrink-0 overflow-hidden lg:h-[220px] ${
          tint === "gold" ? "bg-gold-tint text-premium-text" : "bg-lilac-tint text-brand"
        }`}
      >
        {isPremium ? (
          <span className="absolute left-3.5 top-3.5 z-10 inline-flex h-7 items-center gap-1.5 rounded-full bg-premium-ink px-2.5 text-[12px] font-bold text-premium-gold lg:left-[18px] lg:top-[18px] lg:h-[30px] lg:px-3">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Premium
          </span>
        ) : null}
        <CatalogImage
          alt=""
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          fallback={
            <div className="grid size-full place-items-center">
              <Store aria-hidden="true" className="size-14 lg:size-[70px]" strokeWidth={1.3} />
            </div>
          }
          src={shop.imageUrl}
        />
      </div>
      <div className="flex flex-col gap-2.5 px-5 pb-5 pt-[18px] lg:gap-3 lg:px-7 lg:pb-[26px] lg:pt-[26px]">
        <div className="flex items-center justify-between gap-3">
          <h3
            className={`font-display text-[22px] font-semibold tracking-[-0.02em] lg:text-[28px] ${
              isPremium ? "text-premium-text" : "text-ink"
            }`}
          >
            {shop.name}
          </h3>
          <ArrowUpRight
            aria-hidden="true"
            className="size-5 shrink-0 text-brand transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 lg:size-[22px]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px]">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-lime-tint px-[9px] text-[12px] font-bold text-brand lg:h-[26px] lg:px-2.5 lg:text-[13px]">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Nivel {tier.label}
          </span>
          <span className="flex items-center gap-1 text-muted">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            {formatShopLocation(shop.country_code, shop.administrative_area_codes)}
          </span>
        </div>
        {shop.description ? (
          <p className="line-clamp-2 text-[14px] leading-[1.5] text-muted lg:text-[16px]">{shop.description}</p>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * The open seat at the end of the shops row: a lime card with a dashed plum
 * edge that sends a would-be seller to the landing. Full width under the
 * scroller on a phone, a grid cell at lg.
 */
export function ShopInviteCard() {
  return (
    <Link
      className="mx-5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-[26px] border-[2.5px] border-dashed border-brand bg-accent p-6 text-brand sm:mx-8 lg:mx-0 lg:flex lg:flex-col lg:items-start lg:gap-3.5 lg:rounded-[32px] lg:p-9"
      href="/vender?desde=tiendas"
    >
      <span
        aria-hidden="true"
        className="grid size-[52px] shrink-0 place-items-center rounded-full bg-brand text-accent lg:size-[84px]"
      >
        <Plus className="size-6 lg:size-[38px]" strokeWidth={2.4} />
      </span>
      {/* From lg the heading, text and button settle at the foot of the cell. */}
      <span className="font-display text-[28px] font-semibold leading-none tracking-[-0.03em] lg:mt-auto lg:text-[44px] lg:tracking-[-0.035em]">
        Tu tienda podría estar <em className="italic">aquí.</em>
      </span>
      <span className="col-span-2 text-[15px] font-medium leading-[1.5] lg:text-[17px]">
        Abre tu tienda gratis y aparece en la plaza junto a quienes ya venden.
      </span>
      <span className="col-span-2 inline-flex h-12 items-center gap-2 justify-self-start rounded-full bg-brand px-5 text-[15px] font-semibold text-white lg:mt-4 lg:h-[52px] lg:px-6 lg:text-[16px]">
        Quiero vender
        <ArrowRight aria-hidden="true" className="size-[18px] text-accent" strokeWidth={2.2} />
      </span>
    </Link>
  );
}
