import type { Metadata } from "next";

import { buildCatalogHref, type ResolvedCategorySelection } from "@/lib/categories";
import type { CatalogFilters } from "@/lib/queries/catalog";

export const SITE_NAME = "Plaza Volcanes";

const HOME_TITLE = "Plaza Volcanes: tiendas independientes de México";
// The bare home page is the seller landing, so it speaks to sellers; every
// catalogue view of "/" keeps the buyer wording above.
const LANDING_TITLE = "Plaza Volcanes: abre tu tienda independiente en México";
const LANDING_DESCRIPTION =
  "Abre tu tienda en Plaza Volcanes, publica productos nuevos o usados y recibe el pago directo de cada cliente. 0% comisión para las primeras 100 tiendas.";
const HOME_DESCRIPTION =
  "Compra productos nuevos y usados de tiendas independientes de todo México. Revisa quién vende y acuerda pago y entrega directamente con cada tienda.";

/** Crawl the links, but leave the page itself out of search results. */
const NOINDEX = { index: false, follow: true } as const;

type HomeMetadataInput = {
  filters: CatalogFilters;
  selection: ResolvedCategorySelection;
  /** Whether the selected category has at least one published product. */
  listed: boolean;
};

function describeCategory(selection: ResolvedCategorySelection) {
  const { selectedCategory, selectedSubcategory } = selection;
  if (!selectedCategory) return null;

  const name = selectedSubcategory
    ? `${selectedSubcategory.name} (${selectedCategory.name})`
    : selectedCategory.name;

  return {
    title: `${selectedSubcategory?.name ?? selectedCategory.name}: productos de tiendas independientes`,
    description: `Encuentra productos de ${name} en tiendas independientes de todo México. Nuevos y usados; acuerdas pago y entrega directamente con cada tienda.`,
  };
}

function withSharing(
  { title, description }: { title: string; description: string },
  { canonical, robots }: { canonical?: string; robots?: typeof NOINDEX },
): Metadata {
  // The layout's "%s | Plaza Volcanes" template only reaches child segments,
  // and this page shares the root segment with the layout, so the brand is
  // spelled out here, for the tab and for a shared link alike.
  const shareTitle = title.startsWith(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  return {
    title: { absolute: shareTitle },
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    ...(robots ? { robots } : {}),
    openGraph: {
      type: "website",
      locale: "es_MX",
      siteName: SITE_NAME,
      title: shareTitle,
      description,
      ...(canonical ? { url: canonical } : {}),
    },
    twitter: { card: "summary_large_image", title: shareTitle, description },
  };
}

/**
 * What search engines and link previews read for `/` and its category views.
 *
 * The bare home page and each category with listings are landing pages of
 * their own. Searches, unknown categories and empty categories stay out of the
 * index: they are either endless or thin. Locale and market parameters never
 * make a separate page, so the canonical drops them.
 */
export function buildHomeMetadata({ filters, selection, listed }: HomeMetadataInput): Metadata {
  if (filters.query) {
    return withSharing(
      { title: `Resultados para “${filters.query}”`, description: HOME_DESCRIPTION },
      { robots: NOINDEX },
    );
  }

  if (selection.invalidCategorySelection) {
    return withSharing({ title: HOME_TITLE, description: HOME_DESCRIPTION }, { robots: NOINDEX });
  }

  const category = describeCategory(selection);

  if (!category) {
    return withSharing({ title: LANDING_TITLE, description: LANDING_DESCRIPTION }, { canonical: "/" });
  }

  const canonical = buildCatalogHref({
    categorySlug: selection.selectedCategory?.slug,
    subcategorySlug: selection.selectedSubcategory?.slug,
  });

  return withSharing(category, { canonical, robots: listed ? undefined : NOINDEX });
}
