import { BuyerPanel } from "@/components/home/landing/buyer-panel";
import { BenefitsBento } from "@/components/home/landing/benefits-bento";
import { CrossingTapes } from "@/components/home/landing/crossing-tapes";
import { FinalCta } from "@/components/home/landing/final-cta";
import { LandingArticle } from "@/components/home/landing/landing-article";
import { LandingStores } from "@/components/home/landing/landing-stores";
import { SellerHero } from "@/components/home/landing/seller-hero";
import { SellerStepsShowcase } from "@/components/home/landing/seller-steps-showcase";
import { ProductCard } from "@/components/catalog/product-card";
import type { FoundersProgram } from "@/lib/launch";
import type { PostMeta } from "@/lib/posts";
import type { CatalogFilters } from "@/lib/queries/catalog";
import type { getCatalogStateCounts, getHomeCatalog } from "@/lib/queries/catalog.server";

type HomeLandingProps = {
  catalog: Awaited<ReturnType<typeof getHomeCatalog>>;
  stateCounts: Awaited<ReturnType<typeof getCatalogStateCounts>>;
  filters: CatalogFilters;
  /** The founders promotion: whether it is open and how many spots are taken. */
  founders: FoundersProgram;
  /** The newest published post, briefed on the page; none while the blog is empty. */
  latestPost: PostMeta | null;
};

/**
 * The bare home page: a seller-first landing that still lets a buyer search
 * and browse. Every filtered view of "/" keeps the catalogue screen.
 *
 * All of it reads the one home catalogue query, which is newest first: its
 * first product is the newest listing.
 */
export function HomeLanding({ catalog, stateCounts, filters, founders, latestPost }: HomeLandingProps) {
  const { products, categories, shops } = catalog;
  // Read per request: the landing is rendered on demand, so the offer leaves
  // the page the moment the promotion closes or fills.
  const promoActive = founders.open;

  return (
    <>
      <SellerHero promoActive={promoActive} spotsTaken={founders.taken} latest={products[0] ?? null} example={products[0] ?? null} locale={filters.locale} />
      {products[0] ? (
        <section aria-labelledby="customer-preview" className="mx-auto grid max-w-[1280px] gap-5 px-5 py-10 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] md:items-center xl:px-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Tu enlace, visto por clientes</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink" id="customer-preview">Así pueden ver tus productos</h2>
            <p className="mt-3 max-w-lg leading-7 text-muted">Tu tienda muestra el nombre, fotos y precios de lo que tienes publicado. Este producto pertenece a una tienda real de la plaza.</p>
          </div>
          <ProductCard product={products[0]} variant="compact" locale={filters.locale} />
        </section>
      ) : null}
      <CrossingTapes categories={categories.map((category) => category.name)} />
      <BenefitsBento promoActive={promoActive} />
      <SellerStepsShowcase />
      {latestPost ? <LandingArticle post={latestPost} /> : null}
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
