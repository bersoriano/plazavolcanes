import { BuyerPanel } from "@/components/home/landing/buyer-panel";
import { BenefitsBento } from "@/components/home/landing/benefits-bento";
import { CrossingTapes } from "@/components/home/landing/crossing-tapes";
import { FinalCta } from "@/components/home/landing/final-cta";
import { LandingStores } from "@/components/home/landing/landing-stores";
import { SellerHero } from "@/components/home/landing/seller-hero";
import { SellerStepsShowcase } from "@/components/home/landing/seller-steps-showcase";
import type { FoundersProgram } from "@/lib/launch";
import type { CatalogFilters } from "@/lib/queries/catalog";
import type { getCatalogStateCounts, getHomeCatalog } from "@/lib/queries/catalog.server";

type HomeLandingProps = {
  catalog: Awaited<ReturnType<typeof getHomeCatalog>>;
  stateCounts: Awaited<ReturnType<typeof getCatalogStateCounts>>;
  filters: CatalogFilters;
  /** The founders promotion: whether it is open and how many spots are taken. */
  founders: FoundersProgram;
};

/**
 * The bare home page: a seller-first landing that still lets a buyer search
 * and browse. Every filtered view of "/" keeps the catalogue screen.
 *
 * All of it reads the one home catalogue query, which is newest first: its
 * first product is the newest listing.
 */
export function HomeLanding({ catalog, stateCounts, filters, founders }: HomeLandingProps) {
  const { products, categories, shops } = catalog;
  // Read per request: the landing is rendered on demand, so the offer leaves
  // the page the moment the promotion closes or fills.
  const promoActive = founders.open;

  return (
    <>
      <SellerHero promoActive={promoActive} spotsTaken={founders.taken} latest={products[0] ?? null} locale={filters.locale} />
      <CrossingTapes categories={categories.map((category) => category.name)} />
      <BenefitsBento promoActive={promoActive} />
      <SellerStepsShowcase />
      <LandingStores shops={shops} />
      <BuyerPanel
        categories={categories}
        countryCode={filters.countryCode}
        locale={filters.locale}
        products={products}
        stateCounts={stateCounts}
      />
      {promoActive ? <FinalCta /> : null}
    </>
  );
}
