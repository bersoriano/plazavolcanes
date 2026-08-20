import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronRight, ImageIcon, Store } from "lucide-react";
import { notFound } from "next/navigation";

import { ShareActions } from "@/components/share/share-actions";
import { AddToCartForm } from "@/components/orders/add-to-cart-form";
import {
  DEFAULT_CATALOG_CURRENCY,
  DEFAULT_CATALOG_LOCALE,
  DEFAULT_CATALOG_MARKET,
} from "@/lib/catalog-locale";
import { buildCatalogHref, findCategorySelection } from "@/lib/categories";
import { formatCurrency } from "@/lib/format";
import { formatProductCondition } from "@/lib/product-condition";
import { addToCart } from "@/lib/actions/cart";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";
import { getPublicProduct } from "@/lib/queries/catalog.server";

type ProductSearchParams = Promise<{
  q?: string | string[];
  categoria?: string | string[];
  subcategoria?: string | string[];
  locale?: string | string[];
  countryCode?: string | string[];
}>;

type ProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: ProductSearchParams;
};

function parseProductId(id: string) {
  const value = Number(id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const productId = parseProductId(id);
  if (!productId) return { title: "Producto no encontrado" };
  const product = await getPublicProduct(productId);
  return product ? { title: product.name, description: product.description } : { title: "Producto no encontrado" };
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const [{ id }, rawSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);
  const productId = parseProductId(id);
  if (!productId) notFound();

  const filters = normalizeCatalogFilters(rawSearchParams);
  const product = await getPublicProduct(productId, filters.locale);
  if (!product) notFound();

  const categories = product.category_id
    ? await getProductCategoryTree(filters.locale)
    : [];
  const categorySelection = findCategorySelection(categories, product.category_id);
  const rootCategory = categories.find((category) => category.id === categorySelection.parentId);
  const leafCategory = rootCategory?.children.find(
    (category) => category.id === categorySelection.leafId,
  );
  const catalogHref = buildCatalogHref({
    query: filters.query,
    categorySlug: filters.categorySlug,
    subcategorySlug: filters.subcategorySlug,
    locale: filters.locale,
    countryCode: filters.countryCode,
  });
  const hasCatalogState = Boolean(
    filters.query ||
      filters.categorySlug ||
      filters.subcategorySlug ||
      filters.locale !== DEFAULT_CATALOG_LOCALE ||
      filters.countryCode !== DEFAULT_CATALOG_MARKET,
  );
  const currencyCode = product.currency_code ?? DEFAULT_CATALOG_CURRENCY;
  const addToCartAction = addToCart.bind(null, product.id);

  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand"
        href={hasCatalogState ? catalogHref : `/tiendas/${product.shop.slug}`}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {hasCatalogState ? "Volver a resultados" : product.shop.name}
      </Link>

      {rootCategory ? (
        <nav aria-label="Categoría del producto" className="mt-4 flex flex-wrap items-center gap-1.5 text-sm font-medium text-muted">
          <Link className="inline-flex min-h-11 items-center rounded-full px-3 py-2 hover:text-brand" href={buildCatalogHref({ query: filters.query, categorySlug: rootCategory.slug, locale: filters.locale, countryCode: filters.countryCode })}>
            {rootCategory.name}
          </Link>
          {leafCategory ? (
            <>
              <ChevronRight aria-hidden="true" className="size-4" />
              <Link
                aria-current="page"
                className="inline-flex min-h-11 items-center rounded-full px-3 py-2 font-semibold text-brand"
                href={buildCatalogHref({
                  query: filters.query,
                  categorySlug: rootCategory.slug,
                  subcategorySlug: leafCategory.slug,
                  locale: filters.locale,
                  countryCode: filters.countryCode,
                })}
              >
                {leafCategory.name}
              </Link>
            </>
          ) : null}
        </nav>
      ) : null}

      <div className="mt-7 grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:gap-12">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[#eee8e1]">
          {product.image_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={product.name} className="size-full object-cover" src={product.image_path} />
          ) : (
            <div className="grid size-full place-items-center text-brand/30">
              <ImageIcon aria-hidden="true" className="size-16" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <Link className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-brand-hover" href={`/tiendas/${product.shop.slug}`}>
            <Store aria-hidden="true" className="size-4" />
            {product.shop.name}
          </Link>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-5xl">{product.name}</h1>
          <p className="mt-3 inline-flex w-fit rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-brand">
            {formatProductCondition(product.condition, product.used_condition)}
          </p>
          <p className="mt-5 text-3xl font-semibold text-brand">
            {formatCurrency(product.price_mxn, currencyCode, filters.locale)}{" "}
            <span className="text-sm font-medium text-muted">{currencyCode}</span>
          </p>
          <div className="my-7 h-px bg-line" />
          <p className="whitespace-pre-wrap text-base leading-8 text-muted">{product.description}</p>
          <AddToCartForm action={addToCartAction} />
          <div className="mt-7"><ShareActions label="Compartir producto" title={product.name} /></div>
          <p className="mt-8 rounded-2xl border border-line bg-surface p-4 text-sm leading-6 text-muted">
            Producto publicado por una tienda independiente de Plaza Volcanes.
          </p>
        </div>
      </div>
    </section>
  );
}
