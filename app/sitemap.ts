import type { MetadataRoute } from "next";

import { LEGAL_ROUTES } from "@/lib/legal/document-types";
import { getSitemapCatalog } from "@/lib/queries/sitemap.server";
import { MEXICO_ADMINISTRATIVE_AREAS } from "@/lib/shop-location";
import { buildSiteUrl } from "@/lib/site-url";

/**
 * An absolute URL ready for <loc>. Next writes it into the XML verbatim, and a
 * category view's "&" would otherwise break the whole file.
 */
function sitemapUrl(path: string) {
  return buildSiteUrl(path).replaceAll("&", "&amp;");
}

// The catalog changes whenever a shop publishes, and reading it goes through
// the cookie-bound Supabase client, so this route is built per request rather
// than revalidated on a timer.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { shops, products, categoryPaths } = await getSitemapCatalog();
  const now = new Date();

  return [
    {
      url: sitemapUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    ...MEXICO_ADMINISTRATIVE_AREAS.map((area) => ({
      url: sitemapUrl(`/estado/${area.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    // Only categories with something published: an empty one is marked noindex.
    ...categoryPaths.map((path) => ({
      url: sitemapUrl(path),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...shops.map((shop) => ({
      url: sitemapUrl(`/tiendas/${shop.slug}`),
      lastModified: new Date(shop.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: sitemapUrl(`/productos/${product.slug}`),
      lastModified: new Date(product.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...LEGAL_ROUTES.map((route) => ({
      url: sitemapUrl(route.path),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
