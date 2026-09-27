import { PublicShopCard, ShopInviteCard } from "@/components/catalog/shop-card";
import { Accent, Eyebrow, TYPE } from "@/components/home/landing/primitives";
import type { CatalogShop } from "@/lib/queries/catalog.server";
import { founderRotation as rotation, isFeaturedFounder } from "@/lib/launch";
import type { TrustTier } from "@/lib/trust-tiers";

const TIER_RANK: Record<TrustTier, number> = { top_rated: 0, reliable: 1, standard: 2 };

/** How many shops the section shows: seven and the open seat fill two rows of four. */
const SHOP_LIMIT = 7;

/**
 * The shops worth showing first. Founders inside their 90 days of homepage
 * rotation lead (docs/launch-package.md), reshuffled daily; then Premium,
 * the higher trust tier, a cover photo, and recency, which the query already
 * returns and a stable sort keeps.
 */
export function rankShops(shops: CatalogShop[], now = Date.now()) {
  const day = Math.floor(now / 86_400_000);
  const featured = (shop: CatalogShop) => isFeaturedFounder(shop.founder_since, now);

  return [...shops].sort(
    (a, b) =>
      Number(featured(b)) - Number(featured(a)) ||
      (featured(a) && featured(b) ? rotation(a.id, day) - rotation(b.id, day) : 0) ||
      Number(b.is_premium === true) - Number(a.is_premium === true) ||
      TIER_RANK[a.trust_tier] - TIER_RANK[b.trust_tier] ||
      Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)),
  );
}

/**
 * Real shops and the open seat. From lg a four-column grid of up to seven
 * shops and the invite card; below lg the shops scroll sideways and the
 * invite card sits full width under them.
 */
export function LandingStores({ shops }: { shops: CatalogShop[] }) {
  const ranked = rankShops(shops).slice(0, SHOP_LIMIT);

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
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-4 lg:gap-5">
          {ranked.length ? (
            <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-px-5 px-5 pb-1 sm:scroll-px-8 sm:px-8 lg:contents">
              {ranked.map((shop, index) => (
                <PublicShopCard
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
