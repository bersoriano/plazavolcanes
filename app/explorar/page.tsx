import type { Metadata } from "next";

import { CatalogScreen } from "@/components/catalog/catalog-screen";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";
import { getCatalogStateCounts, getHomeCatalog } from "@/lib/queries/catalog.server";

export const metadata: Metadata = {
  title: "Explorar productos",
  description:
    "Todos los productos nuevos y usados de las tiendas independientes de Plaza Volcanes, del más reciente al más antiguo.",
  alternates: { canonical: "/explorar" },
};

type ExploreSearchParams = Promise<{
  locale?: string | string[];
  countryCode?: string | string[];
}>;

/**
 * The whole plaza, unfiltered: what "/" showed before it became the seller
 * landing. The landing's "Ver toda la plaza" leads here. A search or a
 * category still lives on "/" with its query, so only the market and the
 * language carry over.
 */
export default async function ExplorePage({ searchParams }: { searchParams: ExploreSearchParams }) {
  const { locale, countryCode } = await searchParams;
  const filters = normalizeCatalogFilters({ locale, countryCode });
  const [catalog, stateCounts] = await Promise.all([
    getHomeCatalog(filters),
    getCatalogStateCounts(filters.countryCode),
  ]);

  return <CatalogScreen catalog={catalog} filters={filters} stateCounts={stateCounts} />;
}
