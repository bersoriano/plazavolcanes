import type { Metadata } from "next";

import { buildCatalogHref, type ResolvedCategorySelection } from "@/lib/categories";
import type { CatalogFilters } from "@/lib/queries/catalog";

export const SITE_NAME = "Plaza Volcanes";

const HOME_TITLE = "Plaza Volcanes: tiendas independientes de México";
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
  metadata: Metadata & { title: string | { absolute: string }; description: string },
  { canonical, robots }: { canonical?: string; robots?: typeof NOINDEX },
): Metadata {
  // Open Graph does not go through the title template, so it spells out the
  // name a shared link should carry.
  const shareTitle =
    typeof metadata.title === "string" ? `${metadata.title} | ${SITE_NAME}` : metadata.title.absolute;

  return {
    ...metadata,
    ...(canonical ? { alternates: { canonical } } : {}),
    ...(robots ? { robots } : {}),
    openGraph: {
      type: "website",
      locale: "es_MX",
      siteName: SITE_NAME,
      title: shareTitle,
      description: metadata.description,
      ...(canonical ? { url: canonical } : {}),
    },
    twitter: { card: "summary_large_image", title: shareTitle, description: metadata.description },
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
    return withSharing({ title: { absolute: HOME_TITLE }, description: HOME_DESCRIPTION }, { robots: NOINDEX });
  }

  const category = describeCategory(selection);

  if (!category) {
    return withSharing({ title: { absolute: HOME_TITLE }, description: HOME_DESCRIPTION }, { canonical: "/" });
  }

  const canonical = buildCatalogHref({
    categorySlug: selection.selectedCategory?.slug,
    subcategorySlug: selection.selectedSubcategory?.slug,
  });

  return withSharing(category, { canonical, robots: listed ? undefined : NOINDEX });
}
