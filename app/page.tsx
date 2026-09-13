import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CatalogScreen } from "@/components/catalog/catalog-screen";
import { buildCatalogHref, listingCategoryIds, resolveCategorySelection } from "@/lib/categories";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";
import { getCatalogStateCounts, getHomeCatalog } from "@/lib/queries/catalog.server";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { hasPublishedProducts } from "@/lib/queries/sitemap.server";
import { buildHomeMetadata, SITE_NAME } from "@/lib/seo/home-metadata";
import { buildSiteUrl } from "@/lib/site-url";

type HomeSearchParams = Promise<{
  q?: string | string[];
  categoria?: string | string[];
  subcategoria?: string | string[];
  estado?: string | string[];
  locale?: string | string[];
  countryCode?: string | string[];
}>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: HomeSearchParams;
}): Promise<Metadata> {
  const filters = normalizeCatalogFilters(await searchParams);
  // A state parameter redirects before anything renders.
  if (filters.administrativeAreaSlug) return {};

  const selection = resolveCategorySelection(await getProductCategoryTree(filters.locale), filters);
  // Only a category view needs the count: a search is never indexed, and the
  // bare home page always is.
  const categoryIds = filters.query ? [] : listingCategoryIds(selection);
  const listed = categoryIds.length > 0 && (await hasPublishedProducts(categoryIds));

  return buildHomeMetadata({ filters, selection, listed });
}

/** Names the site and who runs it, for search results and their site name. */
function HomeStructuredData() {
  const url = buildSiteUrl("/");
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: SITE_NAME, alternateName: "Plaza Volcanes México", url, inLanguage: "es-MX" },
      { "@type": "Organization", name: SITE_NAME, url },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Static today, but escaped anyway: a "<" must never close the script.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

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

  const bareHome = !filters.query && !filters.categorySlug && !filters.subcategorySlug && !filters.invalidCategorySelection;

  return (
    <>
      {bareHome ? <HomeStructuredData /> : null}
      <CatalogScreen catalog={catalog} filters={filters} stateCounts={stateCounts} />
    </>
  );
}
