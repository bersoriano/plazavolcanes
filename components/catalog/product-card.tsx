"use client";

import Link from "next/link";
import { ImageIcon } from "lucide-react";

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
    };
  };
  categoryName?: string | null;
  catalogHref?: string;
  eventId?: string | null;
  position?: number;
  locale?: CatalogLocale;
};

export function ProductCard({
  product,
  categoryName,
  catalogHref,
  eventId,
  position,
  locale = DEFAULT_CATALOG_LOCALE,
}: ProductCardProps) {
  const catalogQuery = catalogHref?.includes("?")
    ? catalogHref.slice(catalogHref.indexOf("?"))
    : "";
  const currencyCode = product.currency_code ?? DEFAULT_CATALOG_CURRENCY;

  function recordSelection() {
    if (!eventId || position == null || !Number.isInteger(position) || position < 1) return;

    void fetch("/api/search-events/selection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, productId: product.id, position }),
      keepalive: true,
    }).catch(() => {});
  }

  return (
    <Link className="group block" href={`/productos/${product.slug}${catalogQuery}`} onClick={recordSelection}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.4rem] bg-[#eee8e1]">
        <span className="absolute left-3 top-3 z-10 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-semibold text-brand shadow-sm">
          {formatProductCondition(product.condition, product.used_condition)}
        </span>
        <CatalogImage
          alt={product.name}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          fallback={<div className="grid size-full place-items-center text-brand/35"><ImageIcon aria-hidden="true" className="size-10" /></div>}
          src={product.imageUrl}
        />
      </div>
      <div className="px-1 pt-4">
        <p className="text-sm font-medium text-muted">
          <span>{product.shop.name}</span>
          <span aria-hidden="true"> · </span>
          <span>{formatShopLocation(product.shop.country_code, product.shop.administrative_area_codes)}</span>
          {categoryName ? <><span aria-hidden="true"> · </span><span>{categoryName}</span></> : null}
        </p>
        <h3 className="mt-1 line-clamp-1 font-display text-lg font-semibold tracking-[-0.02em] text-ink">{product.name}</h3>
        <p className="mt-1.5 font-semibold text-ink">{formatCurrency(product.price_mxn, currencyCode, locale)} <span className="text-xs font-medium text-muted">{currencyCode}</span></p>
      </div>
    </Link>
  );
}
