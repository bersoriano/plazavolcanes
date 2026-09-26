"use client";

import Link from "next/link";
import { ImageIcon, MapPin, Sparkles } from "lucide-react";

import { CatalogImage } from "@/components/catalog/catalog-image";
import {
  DEFAULT_CATALOG_CURRENCY,
  DEFAULT_CATALOG_LOCALE,
  type CatalogLocale,
} from "@/lib/catalog-locale";
import { formatCurrency } from "@/lib/format";
import { formatProductCondition, type ProductCondition, type UsedCondition } from "@/lib/product-condition";
import { formatShopLocation } from "@/lib/shop-location";
import type { TrustTier } from "@/lib/trust-tiers";

type ProductCardProps = {
  product: {
    id: number;
    slug: string;
    imageUrl: string | null;
    name: string;
    price_mxn: number | string;
    currency_code?: string;
    category_id?: number | null;
    condition: ProductCondition;
    used_condition: UsedCondition | null;
    shop: {
      name: string;
      country_code: string;
      administrative_area_codes: string[];
      trust_tier: TrustTier;
      is_premium?: boolean;
    };
  };
  categoryName?: string | null;
  catalogHref?: string;
  eventId?: string | null;
  position?: number;
  locale?: CatalogLocale;
  /**
   * `compact` is the home buyer panel's card: a square photo, the shop, the
   * title and a plum price, without the category or the location.
   */
  variant?: "default" | "compact";
};

export function ProductCard({
  product,
  categoryName,
  catalogHref,
  eventId,
  position,
  locale = DEFAULT_CATALOG_LOCALE,
  variant = "default",
}: ProductCardProps) {
  const catalogQuery = catalogHref?.includes("?")
    ? catalogHref.slice(catalogHref.indexOf("?"))
    : "";
  const currencyCode = product.currency_code ?? DEFAULT_CATALOG_CURRENCY;
  const isPremium = product.shop.is_premium === true;
  const compact = variant === "compact";

  function recordSelection() {
    if (!eventId || position == null || !Number.isInteger(position) || position < 1) return;

    void fetch("/api/search-events/selection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, productId: product.id, position }),
      keepalive: true,
    }).catch(() => {});
  }

  if (compact) {
    return (
      <Link className="group flex min-w-0 flex-col gap-3 sm:gap-3.5" href={`/productos/${product.slug}${catalogQuery}`} onClick={recordSelection}>
        <div
          className={`relative aspect-square overflow-hidden rounded-[20px] bg-photo-backdrop sm:rounded-[26px] ${
            isPremium ? "ring-1 ring-premium-gold ring-offset-2 ring-offset-surface" : ""
          }`}
        >
          <span className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-start justify-between gap-1.5 sm:inset-x-3 sm:top-3 sm:max-w-none">
            <span className="flex h-6 items-center truncate rounded-full bg-surface px-2 text-[11px] font-semibold text-ink sm:h-7 sm:px-2.5 sm:text-[12px]">
              {formatProductCondition(product.condition, product.used_condition)}
            </span>
            {isPremium ? (
              <span className="hidden h-7 shrink-0 items-center gap-1 rounded-full bg-premium-ink px-2.5 text-[12px] font-bold text-premium-gold sm:inline-flex">
                <Sparkles aria-hidden="true" className="size-3" />
                Premium
              </span>
            ) : null}
          </span>
          <CatalogImage
            alt={product.name}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
            fallback={<div className="grid size-full place-items-center text-brand/35"><ImageIcon aria-hidden="true" className="size-10" /></div>}
            src={product.imageUrl}
          />
        </div>
        <div className="flex flex-col gap-1">
          <p className={`truncate text-[12px] font-semibold sm:text-[13px] ${isPremium ? "text-premium-text" : "text-muted"}`}>{product.shop.name}</p>
          <h3 className="line-clamp-2 text-[15px] font-bold leading-[1.25] text-ink sm:text-[18px]">{product.name}</h3>
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-[19px] font-bold tracking-[-0.02em] text-brand tabular-nums sm:text-[24px]">{formatCurrency(product.price_mxn, currencyCode, locale)}</span>
            <span className="text-[11px] font-semibold text-muted sm:text-[13px]">{currencyCode}</span>
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link className="group flex min-w-0 flex-col gap-3 sm:gap-4" href={`/productos/${product.slug}${catalogQuery}`} onClick={recordSelection}>
      {/* 4:5 so the portrait photos sellers upload stand whole instead of
          losing their top and bottom. */}
      <div
        className={`relative aspect-[4/5] overflow-hidden rounded-[1.125rem] bg-photo-backdrop sm:rounded-[1.5rem] ${
          isPremium ? "ring-1 ring-premium-gold ring-offset-2 ring-offset-background" : ""
        }`}
      >
        <span className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-full bg-surface/95 px-[9px] py-[5px] text-[11px] font-bold text-brand shadow-sm sm:left-3 sm:top-3 sm:px-3 sm:py-1.5 sm:text-xs">
          {formatProductCondition(product.condition, product.used_condition)}
        </span>
        {isPremium ? (
          // Bottom-left on a phone, where top-right would collide with the
          // condition pill on a narrow card.
          <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-premium-ink px-[9px] py-[5px] text-[11px] font-bold text-premium-gold shadow-sm sm:bottom-auto sm:left-auto sm:right-3 sm:top-3 sm:px-2.5 sm:py-1.5 sm:text-xs">
            <Sparkles aria-hidden="true" className="size-3" />
            Premium
          </span>
        ) : null}
        <CatalogImage
          alt={product.name}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          fallback={<div className="grid size-full place-items-center text-brand/35"><ImageIcon aria-hidden="true" className="size-10" /></div>}
          src={product.imageUrl}
        />
      </div>
      <div className="flex flex-col gap-1 px-0.5 sm:gap-1.5 sm:px-1">
        <p className="truncate text-[12px] text-muted sm:text-[13px]">
          <span className={`font-bold ${isPremium ? "text-premium-text" : "text-ink"}`}>{product.shop.name}</span>
          {categoryName ? <span className="hidden sm:inline"><span aria-hidden="true"> · </span>{categoryName}</span> : null}
        </p>
        <h3 className="line-clamp-2 font-display text-[16px] font-semibold leading-[1.2] tracking-[-0.015em] text-ink sm:text-[20px] sm:tracking-[-0.02em]">{product.name}</h3>
        <p className="flex items-baseline gap-1 sm:gap-1.5">
          <span className="font-display text-[18px] font-bold tracking-[-0.02em] text-ink tabular-nums sm:text-[22px]">{formatCurrency(product.price_mxn, currencyCode, locale)}</span>
          <span className="text-[11px] font-semibold text-muted sm:text-xs">{currencyCode}</span>
        </p>
        <p className="flex items-start gap-1.5 text-[12px] leading-[1.4] text-muted sm:text-[13px] sm:leading-[1.45]">
          <MapPin aria-hidden="true" className="mt-0.5 hidden size-3.5 shrink-0 sm:block" />
          {formatShopLocation(product.shop.country_code, product.shop.administrative_area_codes)}
        </p>
      </div>
    </Link>
  );
}
