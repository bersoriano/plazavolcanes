import "server-only";

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
  if (!isSupabaseConfigured()) return { shops: [], products: [] };

  const supabase = await createServerSupabaseClient();
  const [{ data: shops }, { data: products }] = await Promise.all([
    supabase
      .from("shops")
      .select("slug, updated_at")
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_ROW_LIMIT),
    supabase
      .from("products")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_ROW_LIMIT),
  ]);

  return { shops: mapEntries(shops), products: mapEntries(products) };
}
