import "server-only";

import { buildCatalogHref } from "@/lib/categories";
import { DEFAULT_CATALOG_LOCALE } from "@/lib/catalog-locale";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Sitemaps accept 50,000 URLs. Staying well under it keeps the response small
// enough to build on every request; split with generateSitemaps if the catalog
// ever outgrows this.
const SITEMAP_ROW_LIMIT = 5000;

export type SitemapEntry = { slug: string; updatedAt: string };

export type SitemapCatalog = {
  shops: SitemapEntry[];
  products: SitemapEntry[];
  /** Catalog views of the categories that have something published under them. */
  categoryPaths: string[];
};

function mapEntries(rows: { slug: string; updated_at: string }[] | null) {
  return (rows ?? []).map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
}

/**
 * Public shops and published products, for `app/sitemap.ts`.
 *
 * Anonymous RLS already hides drafts from shops the crawler cannot see, so no
 * privileged key is involved.
 */
export async function getSitemapCatalog(): Promise<SitemapCatalog> {
  if (!isSupabaseConfigured()) return { shops: [], products: [], categoryPaths: [] };

  const supabase = await createServerSupabaseClient();
  // The publication filters below are the ones hasPublishedProducts applies:
  // a category the sitemap lists must never be one the page marks noindex.
  const [{ data: shops }, { data: products }, categories] = await Promise.all([
    supabase
      .from("shops")
      .select("slug, updated_at")
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_ROW_LIMIT),
    supabase
      .from("products")
      .select("slug, updated_at, category_id, shops!inner(is_publishing_approved)")
      .eq("status", "published")
      .eq("is_admin_enabled", true)
      .eq("shops.is_publishing_approved", true)
      .not("expires_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_ROW_LIMIT),
    getProductCategoryTree(DEFAULT_CATALOG_LOCALE),
  ]);

  const listed = new Set((products ?? []).map((product) => product.category_id));
  const categoryPaths = categories.flatMap((category) => {
    const listedChildren = category.children.filter((child) => listed.has(child.id));
    if (!listedChildren.length) return [];

    return [
      buildCatalogHref({ categorySlug: category.slug }),
      ...listedChildren.map((child) =>
        buildCatalogHref({ categorySlug: category.slug, subcategorySlug: child.slug }),
      ),
    ];
  });

  return { shops: mapEntries(shops), products: mapEntries(products), categoryPaths };
}

/**
 * Whether anything public is filed under these categories, so an empty category
 * view can stay out of search results. Counts without reading rows.
 */
export async function hasPublishedProducts(categoryIds: number[]): Promise<boolean> {
  if (!categoryIds.length || !isSupabaseConfigured()) return false;

  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("products")
    .select("id, shops!inner(is_publishing_approved)", { count: "exact", head: true })
    .in("category_id", categoryIds)
    .eq("status", "published")
    .eq("is_admin_enabled", true)
    .eq("shops.is_publishing_approved", true)
    .not("expires_at", "is", null)
    .gt("expires_at", new Date().toISOString());

  return (count ?? 0) > 0;
}
