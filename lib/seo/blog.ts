import type { Metadata } from "next";

import type { PostMeta } from "@/lib/posts";
import { SITE_NAME } from "@/lib/seo/home-metadata";
import { organizationId, organizationSchema } from "@/lib/seo/organization";
import { buildSiteUrl } from "@/lib/site-url";

export const BLOG_PATH = "/blog";
export const BLOG_HEADING = "Guías para vender y comprar en la plaza.";
export const BLOG_DESCRIPTION =
  "Guías prácticas para tiendas independientes y sus clientes: cómo vender, cobrar y comprar directo en Plaza Volcanes.";

const IN_LANGUAGE = "es-MX";

export function postPath(slug: string) {
  return `${BLOG_PATH}/${slug}`;
}

/** The index only earns a place in search once it has something published. */
export function buildBlogMetadata(posts: Pick<PostMeta, "draft">[]): Metadata {
  return {
    title: "Blog",
    description: BLOG_DESCRIPTION,
    alternates: { canonical: BLOG_PATH },
    ...(posts.some((post) => !post.draft) ? {} : { robots: { index: false, follow: true } }),
  };
}

export function buildPostMetadata(post: PostMeta): Metadata {
  const path = postPath(post.slug);

  return {
    title: post.seoTitle ?? post.title,
    description: post.description,
    authors: [{ name: SITE_NAME, url: buildSiteUrl("/") }],
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: path,
      siteName: SITE_NAME,
      locale: "es_MX",
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: [SITE_NAME],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
    ...(post.draft ? { robots: { index: false, follow: false } } : {}),
  };
}

function breadcrumbs(post?: Pick<PostMeta, "slug" | "title">) {
  const items = [
    { name: "Inicio", item: buildSiteUrl("/") },
    { name: "Blog", item: buildSiteUrl(BLOG_PATH) },
    ...(post ? [{ name: post.title, item: buildSiteUrl(postPath(post.slug)) }] : []),
  ];

  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function buildPostJsonLd(post: PostMeta) {
  const url = buildSiteUrl(postPath(post.slug));
  const publisher = { "@id": organizationId() };

  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(),
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.updated ?? post.date,
        inLanguage: IN_LANGUAGE,
        url,
        mainEntityOfPage: url,
        image: `${url}/opengraph-image`,
        author: publisher,
        publisher,
        isPartOf: { "@id": `${buildSiteUrl(BLOG_PATH)}#blog` },
      },
      breadcrumbs(post),
    ],
  };
}

export function buildBlogJsonLd(posts: PostMeta[]) {
  const url = buildSiteUrl(BLOG_PATH);
  const published = posts.filter((post) => !post.draft);

  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(),
      {
        "@type": "Blog",
        "@id": `${url}#blog`,
        url,
        name: `Blog de ${SITE_NAME}`,
        description: BLOG_DESCRIPTION,
        inLanguage: IN_LANGUAGE,
        publisher: { "@id": organizationId() },
        blogPost: published.map((post) => ({ "@id": `${buildSiteUrl(postPath(post.slug))}#article` })),
      },
      {
        "@type": "ItemList",
        numberOfItems: published.length,
        itemListElement: published.map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: post.title,
          url: buildSiteUrl(postPath(post.slug)),
        })),
      },
      breadcrumbs(),
    ],
  };
}
