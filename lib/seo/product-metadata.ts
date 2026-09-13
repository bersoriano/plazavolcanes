import type { Metadata } from "next";

import { DEFAULT_CATALOG_CURRENCY } from "@/lib/catalog-locale";
import { buildCatalogHref } from "@/lib/categories";
import { formatCurrency } from "@/lib/format";
import { formatProductCondition, type ProductCondition, type UsedCondition } from "@/lib/product-condition";
import { SITE_NAME } from "@/lib/seo/home-metadata";
import { buildSiteUrl } from "@/lib/site-url";

export type ProductSeoInput = {
  slug: string;
  name: string;
  description: string;
  price_mxn: number;
  currency_code?: string | null;
  units_available: number;
  condition: ProductCondition;
  used_condition: UsedCondition | null;
  images: string[];
  shop: { name: string; slug: string };
};

type Crumb = { name: string; slug: string };
export type ProductBreadcrumb = { category?: Crumb; subcategory?: Crumb };

const DESCRIPTION_LIMIT = 160;
/** Google shows a handful; the rest only make the page heavier. */
const STRUCTURED_IMAGE_LIMIT = 5;

function productPath(slug: string) {
  return `/productos/${slug}`;
}

/** Fits text into `limit` characters, ending on a whole word. */
function truncate(text: string, limit: number) {
  if (text.length <= limit) return text;

  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:·-]+$/, "")}…`;
}

/**
 * The search result and link preview for a product: what it is, what it costs
 * and who sells it come first, because a seller's own description can be a
 * single line or several paragraphs.
 */
export function buildProductMetadata(product: ProductSeoInput): Metadata {
  const condition = formatProductCondition(product.condition, product.used_condition);
  const currency = product.currency_code ?? DEFAULT_CATALOG_CURRENCY;
  const title = `${product.name} (${condition}) | ${SITE_NAME}`;
  const summary = `${formatCurrency(product.price_mxn, currency)} ${currency} · ${condition} · Vendido por ${product.shop.name} en ${SITE_NAME}.`;
  const sellerWords = product.description.replace(/\s+/g, " ").trim();
  const description = truncate(sellerWords ? `${summary} ${sellerWords}` : summary, DESCRIPTION_LIMIT);
  const canonical = productPath(product.slug);
  const photo = product.images[0];

  return {
    // Spelled out rather than left to the layout's template, so the tab and the
    // Open Graph and Twitter titles are one string.
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "es_MX",
      siteName: SITE_NAME,
      url: canonical,
      title,
      description,
      // Without a photo the plaza's own card, app/opengraph-image, stays.
      ...(photo ? { images: [{ url: photo, alt: product.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(photo ? { images: [photo] } : {}),
    },
  };
}

/**
 * Product, offer and breadcrumb for search results.
 *
 * Only what the listing itself states. The shop's rating is not the product's,
 * and search engines do not accept a seller's reviews as a product rating;
 * shipping and returns are set per shop in prose, so they are left out rather
 * than guessed.
 */
export function buildProductJsonLd(product: ProductSeoInput, breadcrumb: ProductBreadcrumb) {
  const url = buildSiteUrl(productPath(product.slug));
  const { category, subcategory } = breadcrumb;
  const images = product.images.slice(0, STRUCTURED_IMAGE_LIMIT);
  const categoryPath = [category?.name, subcategory?.name].filter(Boolean).join(" > ");

  const crumbs = [
    { name: SITE_NAME, item: buildSiteUrl("/") },
    ...(category ? [{ name: category.name, item: buildSiteUrl(buildCatalogHref({ categorySlug: category.slug })) }] : []),
    ...(category && subcategory
      ? [
          {
            name: subcategory.name,
            item: buildSiteUrl(buildCatalogHref({ categorySlug: category.slug, subcategorySlug: subcategory.slug })),
          },
        ]
      : []),
    { name: product.name, item: url },
  ];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: product.description,
        ...(images.length ? { image: images } : {}),
        sku: product.slug,
        ...(categoryPath ? { category: categoryPath } : {}),
        offers: {
          "@type": "Offer",
          url,
          price: Number(product.price_mxn).toFixed(2),
          priceCurrency: product.currency_code ?? DEFAULT_CATALOG_CURRENCY,
          availability:
            product.units_available > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition:
            product.condition === "new" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
          seller: {
            "@type": "Organization",
            name: product.shop.name,
            url: buildSiteUrl(`/tiendas/${product.shop.slug}`),
          },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })),
      },
    ],
  } as const;
}
