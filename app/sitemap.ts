import type { MetadataRoute } from "next";

import { LEGAL_ROUTES } from "@/lib/legal/document-types";
import type { PostMeta } from "@/lib/posts";
import { getPosts } from "@/lib/posts.server";
import { getSitemapCatalog } from "@/lib/queries/sitemap.server";
import { BLOG_PATH, postPath } from "@/lib/seo/blog";
import { MEXICO_ADMINISTRATIVE_AREAS } from "@/lib/shop-location";
import { buildSiteUrl } from "@/lib/site-url";

function postLastModified(post: Pick<PostMeta, "date" | "updated">) {
  return post.updated ?? post.date;
}

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
  const [{ shops, products, categoryPaths }, allPosts] = await Promise.all([getSitemapCatalog(), getPosts()]);
  // Drafts are listed in development, but they are noindex everywhere.
  const posts = allPosts.filter((post) => !post.draft);
  const now = new Date();

  return [
    {
      url: sitemapUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: sitemapUrl("/explorar"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: sitemapUrl("/como-comprar"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
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
    // An empty blog is marked noindex, so it joins with its first post.
    ...(posts.length
      ? [
          {
            url: sitemapUrl(BLOG_PATH),
            lastModified: new Date(posts.map(postLastModified).sort().at(-1)!),
            changeFrequency: "weekly" as const,
            priority: 0.5,
          },
        ]
      : []),
    ...posts.map((post) => ({
      url: sitemapUrl(postPath(post.slug)),
      lastModified: new Date(postLastModified(post)),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...LEGAL_ROUTES.map((route) => ({
      url: sitemapUrl(route.path),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
