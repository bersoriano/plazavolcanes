import type { MetadataRoute } from "next";

import { LEGAL_ROUTES } from "@/lib/legal/document-types";
import { getSitemapCatalog } from "@/lib/queries/sitemap.server";
import { MEXICO_ADMINISTRATIVE_AREAS } from "@/lib/shop-location";
import { buildSiteUrl } from "@/lib/site-url";

// The catalog changes whenever a shop publishes, and reading it goes through
// the cookie-bound Supabase client, so this route is built per request rather
// than revalidated on a timer.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { shops, products } = await getSitemapCatalog();
  const now = new Date();

  return [
    {
      url: buildSiteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    ...MEXICO_ADMINISTRATIVE_AREAS.map((area) => ({
      url: buildSiteUrl(`/estado/${area.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...shops.map((shop) => ({
      url: buildSiteUrl(`/tiendas/${shop.slug}`),
      lastModified: new Date(shop.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: buildSiteUrl(`/productos/${product.slug}`),
      lastModified: new Date(product.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...LEGAL_ROUTES.map((route) => ({
      url: buildSiteUrl(route.path),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
