import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { CategoryNavigation } from "@/components/catalog/category-navigation";
import { ProductCard } from "@/components/catalog/product-card";
import { SearchBar } from "@/components/catalog/search-bar";
import { Accent, Eyebrow } from "@/components/home/landing/primitives";
import type { CatalogLocale } from "@/lib/catalog-locale";
import type { CategoryTree } from "@/lib/categories";
import type { CatalogProduct, CatalogStateCount } from "@/lib/queries/catalog.server";
import { findAdministrativeAreaByCode } from "@/lib/shop-location";

/** Where "Ver toda la plaza" and the guide live now that "/" is the landing. */
export const ALL_PRODUCTS_HREF = "/explorar";
export const HOW_TO_BUY_HREF = "/como-comprar";

const PROMISES = ["No necesitas cuenta para ver productos", "Págale directo a cada tienda", "Todo queda por escrito"];

/**
 * The buyer's corner of the landing: the plaza's existing search, state
 * filter and category row, the three newest listings and a way into the full
 * catalogue. A white panel from lg; full bleed with a top rule on a phone.
 */
export function BuyerPanel({
  products,
  categories,
  stateCounts,
  locale,
  countryCode,
}: {
  products: CatalogProduct[];
  categories: CategoryTree[];
  stateCounts: CatalogStateCount[];
  locale?: CatalogLocale;
  countryCode?: string;
}) {
  // Where the listings are, busiest state first.
  const places = [...stateCounts]
    .sort((a, b) => b.count - a.count)
    .map((entry) => findAdministrativeAreaByCode(entry.code)?.label)
    .filter(Boolean)
    .slice(0, 2);

  return (
    <section
      aria-labelledby="explorar-heading"
      className="scroll-mt-20 border-t border-line bg-surface px-5 pb-12 pt-14 sm:px-8 lg:scroll-mt-24 lg:border-0 lg:bg-transparent lg:pb-24 lg:pt-10 xl:px-20"
      id="explorar"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-5 lg:gap-7 lg:rounded-panel lg:border lg:border-line lg:bg-surface lg:px-14 lg:py-16">
        <div className="flex flex-col gap-3.5 lg:gap-4">
          <Eyebrow>¿Vienes a comprar?</Eyebrow>
          <h2
            className="font-display text-[clamp(40px,31.1px+2.286vw,64px)] font-semibold leading-[1.01] tracking-[-0.04em] text-ink"
            id="explorar-heading"
          >
            Encuentra productos únicos <Accent>cerca de ti.</Accent>
          </h2>
        </div>

        <SearchBar countryCode={countryCode} locale={locale} variant="panel" />
        <CategoryNavigation countryCode={countryCode} locale={locale} tree={categories} variant="panel" />

        <div className="mt-2 grid grid-cols-2 gap-x-3.5 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {products.slice(0, 3).map((product, index) => (
            <ProductCard
              key={product.id}
              locale={locale}
              position={index + 1}
              product={product}
              variant="compact"
            />
          ))}
          <Link
            className="flex aspect-square flex-col justify-between self-start rounded-[20px] bg-brand p-5 text-white transition-colors hover:bg-brand-hover sm:rounded-[26px] sm:p-7 md:col-span-3 md:aspect-auto md:min-h-[180px] lg:col-span-1 lg:aspect-square"
            href={ALL_PRODUCTS_HREF}
          >
            <span className="font-display text-[24px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[34px]">
              Ver toda <Accent className="text-accent">la plaza.</Accent>
            </span>
            <span className="flex flex-col gap-1.5 text-[13px] text-white/80 sm:text-[15px]">
              {places.length ? <span>{places.join(" · ")}</span> : null}
              <span
                aria-hidden="true"
                className="mt-2.5 grid size-10 place-items-center rounded-full bg-accent text-brand sm:size-12"
              >
                <ArrowRight className="size-5" strokeWidth={2.2} />
              </span>
            </span>
          </Link>
        </div>

        <div className="mt-2 flex flex-col gap-3.5 border-t border-hairline pt-6 text-[15px] font-semibold text-ink lg:mt-auto lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-10 lg:text-[16px]">
          <ul className="flex flex-col gap-3.5 lg:flex-row lg:gap-10">
            {PROMISES.map((promise) => (
              <li className="flex items-center gap-2.5" key={promise}>
                <span
                  aria-hidden="true"
                  className="grid size-[26px] shrink-0 place-items-center rounded-full bg-brand text-accent"
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {promise}
              </li>
            ))}
          </ul>
          <Link
            className="inline-flex min-h-11 items-center self-start text-brand underline decoration-accent decoration-[3px] underline-offset-4 lg:ml-auto lg:self-auto"
            href={HOW_TO_BUY_HREF}
          >
            Cómo comprar en la plaza →
          </Link>
        </div>
      </div>
    </section>
  );
}
