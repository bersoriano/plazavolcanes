import { BenefitsBento } from "@/components/home/landing/benefits-bento";
import { CrossingTapes } from "@/components/home/landing/crossing-tapes";
import type { CollageProduct } from "@/components/home/landing/hero-collage";
import { SellerHero } from "@/components/home/landing/seller-hero";
import { SellerStepsShowcase } from "@/components/home/landing/seller-steps-showcase";
import type { CatalogFilters } from "@/lib/queries/catalog";
import type { getCatalogStateCounts, getHomeCatalog } from "@/lib/queries/catalog.server";

type HomeLandingProps = {
  catalog: Awaited<ReturnType<typeof getHomeCatalog>>;
  stateCounts: Awaited<ReturnType<typeof getCatalogStateCounts>>;
  filters: CatalogFilters;
};

/**
 * The bare home page: a seller-first landing that still lets a buyer search
 * and browse. Every filtered view of "/" keeps the catalogue screen.
 *
 * All of it reads the one home catalogue query, which is newest first: its
 * first product is the newest listing, and the first two with a photo fill
 * the hero's tiles.
 */
export function HomeLanding({ catalog, filters }: HomeLandingProps) {
  const { products, categories } = catalog;
  const photographed = products.filter((product) => product.imageUrl);
  const tiles: [CollageProduct | null, CollageProduct | null] = [photographed[0] ?? null, photographed[1] ?? null];

  return (
    <>
      <SellerHero latest={products[0] ?? null} locale={filters.locale} tiles={tiles} />
      <CrossingTapes categories={categories.map((category) => category.name)} />
      <BenefitsBento />
      <SellerStepsShowcase />
    </>
  );
}
