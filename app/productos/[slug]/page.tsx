import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Store } from "lucide-react";
import { notFound } from "next/navigation";

import { ProductGallery } from "@/components/catalog/product-gallery";
import { ShareActions } from "@/components/share/share-actions";
import { StartConversationButton } from "@/components/messages/start-conversation-button";
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
import { openConversation } from "@/lib/actions/start-conversation";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicProduct } from "@/lib/queries/catalog.server";

// Where a purchase that could not be finished sends the buyer back to.
const PURCHASE_NOTICES: Record<string, string> = {
  agotado: "Este producto ya no está disponible. Busca otro en la plaza.",
  error: "No pudimos agregar el producto a tu carrito. Inténtalo de nuevo.",
};

type ProductSearchParams = Promise<{
  compra?: string | string[];
  q?: string | string[];
  categoria?: string | string[];
  subcategoria?: string | string[];
  locale?: string | string[];
  countryCode?: string | string[];
}>;

type ProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: ProductSearchParams;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  return product ? { title: product.name, description: product.description } : { title: "Producto no encontrado" };
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<Awaited<ProductSearchParams>>({}),
  ]);
  const filters = normalizeCatalogFilters(rawSearchParams);
  const product = await getPublicProduct(slug, filters.locale);
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
  const purchaseNotice =
    typeof rawSearchParams.compra === "string" ? PURCHASE_NOTICES[rawSearchParams.compra] : undefined;
  const productPath = `/productos/${product.slug}`;
  // Shop and product are bound here, from the listing this page loaded, so the
  // thread is about what the shopper is looking at and nothing the browser sends
  // can change either one.
  const messageAction = openConversation.bind(null, product.shopId, product.id);

  let viewerId: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getClaims();
    viewerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  }

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
        <ProductGallery images={product.images} name={product.name} />
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
          {purchaseNotice ? (
            <p
              className="mt-7 rounded-2xl bg-sale/10 px-4 py-3 text-sm font-medium text-sale"
              role="status"
            >
              {purchaseNotice}
            </p>
          ) : null}
          <AddToCartForm
            action={addToCartAction}
            productPath={productPath}
            unitsAvailable={product.units_available}
          />
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <StartConversationButton
              action={messageAction}
              isOwnShop={viewerId === product.shopOwnerId}
              label="Preguntar por este producto"
              returnTo={productPath}
              signedIn={Boolean(viewerId)}
            />
            <ShareActions label="Compartir producto" title={product.name} />
          </div>
          <p className="mt-8 rounded-2xl border border-line bg-surface p-4 text-sm leading-6 text-muted">
            Producto publicado por una tienda independiente de Plaza Volcanes.
          </p>
        </div>
      </div>
    </section>
  );
}
