import Link from "next/link";

import { BuyerPanel } from "@/components/home/landing/buyer-panel";
import type { CatalogFilters } from "@/lib/queries/catalog";
import type { getCatalogStateCounts, getHomeCatalog } from "@/lib/queries/catalog.server";

type HomeLandingProps = {
  catalog: Awaited<ReturnType<typeof getHomeCatalog>>;
  stateCounts: Awaited<ReturnType<typeof getCatalogStateCounts>>;
  filters: CatalogFilters;
};

export function HomeLanding({ catalog, stateCounts, filters }: HomeLandingProps) {
  return (
    <>
      <BuyerPanel
        categories={catalog.categories}
        countryCode={filters.countryCode}
        locale={filters.locale}
        products={catalog.products}
        stateCounts={stateCounts}
      />
      <section className="mx-auto max-w-[1280px] px-5 pb-12 sm:px-8">
        <p className="text-sm text-muted">
          ¿Quieres vender en la plaza?{" "}
          <Link className="font-semibold text-brand underline underline-offset-4" href="/vender">Conoce cómo vender</Link>
        </p>
      </section>
    </>
  );
}
