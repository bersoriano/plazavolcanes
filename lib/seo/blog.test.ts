import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PostMeta } from "@/lib/posts";
import { buildBlogJsonLd, buildBlogMetadata, buildPostJsonLd, buildPostMetadata } from "@/lib/seo/blog";

const post: PostMeta = {
  slug: "como-fijar-precios",
  title: "Cómo fijar precios sin regalar tu trabajo",
  description: "Una guía corta.",
  date: "2026-10-17",
  draft: false,
};

type Node = Record<string, unknown> & { "@type": string };
const node = (graph: Node[], type: string) => graph.find((item) => item["@type"] === type)!;

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com"));
afterEach(() => vi.unstubAllEnvs());

describe("buildPostMetadata", () => {
  it("describes the post as an article with its own canonical", () => {
    const metadata = buildPostMetadata({ ...post, updated: "2026-10-20" });

    expect(metadata.title).toBe(post.title);
    expect(metadata.description).toBe(post.description);
    expect(metadata.alternates).toEqual({ canonical: "/blog/como-fijar-precios" });
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      url: "/blog/como-fijar-precios",
      locale: "es_MX",
      publishedTime: "2026-10-17",
      modifiedTime: "2026-10-20",
    });
    expect(metadata.robots).toBeUndefined();
  });

  it("prefers the short search title, keeping the full one for sharing", () => {
    const metadata = buildPostMetadata({ ...post, seoTitle: "Fijar precios" });

    expect(metadata.title).toBe("Fijar precios");
    expect(metadata.openGraph?.title).toBe(post.title);
  });

  it("keeps a draft out of the index", () => {
    expect(buildPostMetadata({ ...post, draft: true }).robots).toEqual({ index: false, follow: false });
  });
});

describe("buildBlogMetadata", () => {
  it("is its own canonical page", () => {
    expect(buildBlogMetadata([post]).alternates).toEqual({ canonical: "/blog" });
    expect(buildBlogMetadata([post]).robots).toBeUndefined();
  });

  it("keeps the blog out of the index until something is published", () => {
    expect(buildBlogMetadata([]).robots).toEqual({ index: false, follow: true });
    expect(buildBlogMetadata([{ ...post, draft: true }]).robots).toEqual({ index: false, follow: true });
  });
});

describe("buildPostJsonLd", () => {
  it("publishes the post under the plaza's organization, with its dates and image", () => {
    const graph = buildPostJsonLd(post)["@graph"] as Node[];
    const article = node(graph, "BlogPosting");
    const organization = node(graph, "Organization");

    expect(article).toMatchObject({
      "@id": "https://plazavolcanes.com/blog/como-fijar-precios#article",
      headline: post.title,
      datePublished: "2026-10-17",
      dateModified: "2026-10-17",
      inLanguage: "es-MX",
      url: "https://plazavolcanes.com/blog/como-fijar-precios",
      image: "https://plazavolcanes.com/blog/como-fijar-precios/opengraph-image",
    });
    expect(article.publisher).toEqual({ "@id": organization["@id"] });
    expect(article.author).toEqual({ "@id": organization["@id"] });
  });

  it("gives the trail from home to the post", () => {
    const trail = node(buildPostJsonLd(post)["@graph"] as Node[], "BreadcrumbList").itemListElement as {
      name: string;
      item: string;
    }[];

    expect(trail.map(({ name, item }) => [name, item])).toEqual([
      ["Inicio", "https://plazavolcanes.com/"],
      ["Blog", "https://plazavolcanes.com/blog"],
      [post.title, "https://plazavolcanes.com/blog/como-fijar-precios"],
    ]);
  });
});

describe("buildBlogJsonLd", () => {
  it("lists published posts only", () => {
    const graph = buildBlogJsonLd([post, { ...post, slug: "borrador", draft: true }])["@graph"] as Node[];

    expect(node(graph, "Blog").blogPost).toEqual([{ "@id": "https://plazavolcanes.com/blog/como-fijar-precios#article" }]);
    expect(node(graph, "ItemList").numberOfItems).toBe(1);
  });
});
