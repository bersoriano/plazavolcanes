import { redirect } from "next/navigation";

import { CatalogScreen } from "@/components/catalog/catalog-screen";
import { buildCatalogHref } from "@/lib/categories";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";
import { getCatalogStateCounts, getHomeCatalog } from "@/lib/queries/catalog.server";

type HomeSearchParams = Promise<{
  q?: string | string[];
  categoria?: string | string[];
  subcategoria?: string | string[];
  estado?: string | string[];
  locale?: string | string[];
  countryCode?: string | string[];
}>;

export default async function Home({ searchParams }: { searchParams: HomeSearchParams }) {
  const filters = normalizeCatalogFilters(await searchParams);

  // A state is a place, not a query parameter: send it to its canonical path.
  if (filters.administrativeAreaSlug) {
    redirect(
      buildCatalogHref({
        query: filters.query,
        categorySlug: filters.categorySlug,
        subcategorySlug: filters.subcategorySlug,
        stateSlug: filters.administrativeAreaSlug,
        locale: filters.locale,
        countryCode: filters.countryCode,
      }),
    );
  }

  const [catalog, stateCounts] = await Promise.all([
    getHomeCatalog(filters),
    getCatalogStateCounts(filters.countryCode),
  ]);

  return <CatalogScreen catalog={catalog} filters={filters} stateCounts={stateCounts} />;
}
