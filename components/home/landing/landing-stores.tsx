import { PublicShopCard, ShopInviteCard } from "@/components/catalog/shop-card";
import { Accent, Eyebrow, TYPE } from "@/components/home/landing/primitives";
import type { CatalogShop } from "@/lib/queries/catalog.server";
import type { TrustTier } from "@/lib/trust-tiers";

const TIER_RANK: Record<TrustTier, number> = { top_rated: 0, reliable: 1, standard: 2 };

/** How many shops the phone's scroller carries; the desktop grid shows two. */
const SCROLLER_LIMIT = 6;

/**
 * The shops worth showing first: premium, then by trust tier, then those
 * with a cover photo. The query already returns them newest first, and the
 * sort is stable, so recency breaks every remaining tie.
 */
export function rankShops(shops: CatalogShop[]) {
  return [...shops].sort(
    (a, b) =>
      Number(b.is_premium === true) - Number(a.is_premium === true) ||
      TIER_RANK[a.trust_tier] - TIER_RANK[b.trust_tier] ||
      Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)),
  );
}

/**
 * Real shops and the open seat. From lg a three-column grid: the top two
 * shops and the invite card. Below lg the shops scroll sideways and the
 * invite card sits full width under them.
 */
export function LandingStores({ shops }: { shops: CatalogShop[] }) {
  const ranked = rankShops(shops).slice(0, SCROLLER_LIMIT);

  return (
    <section
      aria-labelledby="tiendas-heading"
      className="scroll-mt-20 pb-10 pt-14 lg:scroll-mt-24 lg:px-8 lg:pb-12 lg:pt-24 xl:px-20"
      id="tiendas"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:gap-12">
        <div className="flex flex-col gap-4 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:px-0">
          <div className="flex flex-col gap-3.5 lg:gap-4">
            <Eyebrow>Conoce a quienes venden</Eyebrow>
            <h2 className={`${TYPE.h2} text-ink`} id="tiendas-heading">
              Tiendas <Accent>de la plaza.</Accent>
            </h2>
          </div>
          <p className={`${TYPE.aside} lg:max-w-[360px] lg:pb-2`}>
            Tiendas reales, con nivel y reseñas. La siguiente puede ser la tuya.
          </p>
        </div>

        {/* The scroller dissolves into the grid at lg, so its cards and the
            invite card become the grid's cells. */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-5">
          {ranked.length ? (
            <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-px-5 px-5 pb-1 sm:scroll-px-8 sm:px-8 lg:contents">
              {ranked.map((shop, index) => (
                <PublicShopCard
                  className={index >= 2 ? "lg:hidden" : ""}
                  key={shop.id}
                  shop={shop}
                  tint={index % 2 ? "gold" : "lilac"}
                />
              ))}
            </div>
          ) : null}
          <ShopInviteCard />
        </div>
      </div>
    </section>
  );
}
