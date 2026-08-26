import Link from "next/link";
import { ArrowRight, MapPin, SearchX, Sparkles, Store } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { CategoryNavigation } from "@/components/catalog/category-navigation";
import { ProductCard } from "@/components/catalog/product-card";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SearchBar } from "@/components/catalog/search-bar";
import { PublicShopCard } from "@/components/catalog/shop-card";
import { BuyerSteps } from "@/components/home/buyer-steps";
import { SellerPitch } from "@/components/home/seller-pitch";
import { StateExplorer } from "@/components/home/state-explorer";
import { TrustStrip } from "@/components/home/trust-strip";
import { EmptyState } from "@/components/ui/empty-state";
import { buildCatalogHref } from "@/lib/categories";
import type { CatalogFilters } from "@/lib/queries/catalog";
import type {
  CatalogStateCount,
  getCatalogStateCounts,
  getHomeCatalog,
} from "@/lib/queries/catalog.server";
import type { AdministrativeArea } from "@/lib/shop-location";

type CatalogData = Awaited<ReturnType<typeof getHomeCatalog>>;

type CatalogScreenProps = {
  filters: CatalogFilters;
  catalog: CatalogData;
  /** Present when the visitor is browsing one state rather than all of México. */
  area?: AdministrativeArea;
  stateCounts?: Awaited<ReturnType<typeof getCatalogStateCounts>>;
};

export function CatalogScreen({ filters, catalog, area, stateCounts }: CatalogScreenProps) {
  const {
    products,
    shops,
    categories,
    selectedCategory,
    selectedSubcategory,
    invalidCategorySelection,
    searchEventId,
  } = catalog;
  const activeCategorySlug = invalidCategorySelection ? undefined : selectedCategory?.slug;
  const activeSubcategorySlug = invalidCategorySelection ? undefined : selectedSubcategory?.slug;
  const activeCategoryName = invalidCategorySelection
    ? undefined
    : (selectedSubcategory?.name ?? selectedCategory?.name);
  const stateSlug = area?.slug;
  const catalogHref = buildCatalogHref({
    query: filters.query,
    categorySlug: activeCategorySlug,
    subcategorySlug: activeSubcategorySlug,
    stateSlug,
    locale: filters.locale,
    countryCode: filters.countryCode,
  });
  const resetHref = buildCatalogHref({
    stateSlug,
    locale: filters.locale,
    countryCode: filters.countryCode,
  });
  const categoryNameById = new Map(
    categories.flatMap((category) => [
      [category.id, category.name] as const,
      ...category.children.map((subcategory) => [subcategory.id, subcategory.name] as const),
    ]),
  );
  // The state scopes the page rather than filtering within it, so it never counts here.
  const hasFilters = Boolean(filters.query || activeCategorySlug);
  const coldStart = !hasFilters && products.length === 0;
  const populatedHome = !area && !hasFilters && !coldStart;
  const placeSuffix = area ? ` en ${area.label}` : "";
  const heading = filters.query
    ? activeCategoryName
      ? `Productos para “${filters.query}” en ${activeCategoryName}`
      : `Productos para “${filters.query}”`
    : activeCategoryName
      ? `Productos de ${activeCategoryName}${placeSuffix}`
      : area
        ? `Recién publicado en ${area.label}`
        : "Descubrimientos de la plaza";

  const catalogSection = (
    <section
      aria-labelledby="catalogo-heading"
      className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12"
      id="catalogo"
    >
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            {hasFilters ? "Resultados" : "Recién publicados"}
          </p>
          <h2
            className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl"
            id="catalogo-heading"
          >
            {heading}
          </h2>
        </div>
        <nav aria-label="Vistas del catálogo" className="flex flex-wrap gap-2">
          {hasFilters ? (
            <Link className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href={resetHref}>
              Limpiar filtros
            </Link>
          ) : (
            <span className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-brand-hover">
              Todos
            </span>
          )}
          <span className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted">
            Más recientes
          </span>
          <Link className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted" href="#tiendas">
            Tiendas
          </Link>
        </nav>
      </div>
      <ProductGrid>
        {products.length ? (
          products.map((product, index) => (
            <ProductCard
              catalogHref={catalogHref}
              categoryName={categoryNameById.get(product.category_id ?? -1)}
              eventId={searchEventId}
              key={product.id}
              position={index + 1}
              product={product}
              locale={filters.locale}
            />
          ))
        ) : (
          <EmptyState
            action={
              <Link className="inline-flex items-center gap-2 font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4" href={hasFilters ? resetHref : "/registro"}>
                {hasFilters ? "Limpiar filtros" : "Crear una tienda"}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            }
            description={
              hasFilters
                ? "Prueba con otros filtros o explora todos los productos."
                : area
                  ? `Todavía nadie publica en ${area.label}. Tu tienda puede ser la primera.`
                  : "Abre la primera tienda de la plaza y comparte lo que haces."
            }
            icon={hasFilters ? <SearchX aria-hidden="true" className="size-7" /> : <Store aria-hidden="true" className="size-7" />}
            title={hasFilters ? "No encontramos productos" : "Aún no hay productos publicados"}
          />
        )}
      </ProductGrid>
    </section>
  );

  const shopsSection = shops.length ? (
    <section className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8 lg:px-12" id="tiendas">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Conoce a quienes venden</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">
          {area ? `Tiendas de ${area.label}` : "Tiendas de la plaza"}
        </h2>
      </div>
      <div className="flex gap-5 overflow-x-auto pb-3">
        {shops.map((shop) => <PublicShopCard key={shop.id} shop={shop} />)}
      </div>
    </section>
  ) : null;

  const explorerSection =
    !area && !hasFilters && stateCounts?.length ? <StateExplorer counts={stateCounts as CatalogStateCount[]} /> : null;

  return (
    <>
      <section className="overflow-hidden border-b border-line bg-surface">
        <div className="mx-auto max-w-[1440px] px-5 pb-8 pt-14 sm:px-8 sm:pb-10 sm:pt-20 lg:px-12">
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-brand-hover">
              {area ? <MapPin aria-hidden="true" className="size-4" /> : <Sparkles aria-hidden="true" className="size-4" />}
              {area
                ? `Tiendas de ${area.label}`
                : coldStart
                  ? "Publicar es gratis y sin comisiones."
                  : "Hecho cerca. Encontrado aquí."}
            </div>
            <h1 className="font-display text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-brand sm:text-6xl lg:text-7xl">
              {area
                ? `Productos en ${area.label}`
                : coldStart
                  ? "Abre la primera tienda de la plaza."
                  : populatedHome
                    ? "Encuentra productos únicos cerca de ti."
                    : "Una plaza llena de cosas que no encuentras en cualquier lugar."}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              {area
                ? `Descubre lo que publican las tiendas que operan en ${area.label}.`
                : coldStart
                  ? "Plaza Volcanes está lista para tus productos. Crea tu tienda, publica lo que haces y empieza a recibir pedidos."
                  : populatedHome
                    ? "Explora artículos nuevos y usados, revisa quién vende y acuerda pago y entrega directamente con cada tienda."
                    : "Explora productos de tiendas independientes y descubre quién está detrás de cada pieza."}
            </p>
            {area ? (
              <div className="mt-7">
                <Link
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-brand transition-colors hover:border-brand"
                  href={buildCatalogHref({ locale: filters.locale, countryCode: filters.countryCode })}
                >
                  Ver todo México
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            ) : null}
            {!area && coldStart ? (
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-7 font-semibold text-white transition-transform hover:-translate-y-0.5"
                  href="/registro"
                >
                  Crear mi tienda
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center rounded-full border border-line bg-surface px-6 font-semibold text-brand transition-colors hover:border-brand"
                  href="/ingresar"
                >
                  Ya tengo cuenta
                </Link>
              </div>
            ) : null}
            {populatedHome ? (
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-7 font-semibold text-white transition-transform hover:-translate-y-0.5"
                  href="#catalogo"
                >
                  Explorar productos
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center rounded-full border border-line bg-surface px-6 font-semibold text-brand transition-colors hover:border-brand"
                  href="/registro"
                >
                  Abrir mi tienda
                </Link>
              </div>
            ) : null}
            <div className="relative z-10 mx-auto mt-9 max-w-2xl">
              <SearchBar
                categorySlug={activeCategorySlug}
                defaultValue={filters.query}
                subcategorySlug={activeSubcategorySlug}
                stateSlug={stateSlug}
                locale={filters.locale}
                countryCode={filters.countryCode}
              />
            </div>
            <VolcanoMark className="pointer-events-none absolute -bottom-24 left-1/2 w-[760px] max-w-none -translate-x-1/2 text-brand/8" />
          </div>
          <div className="relative z-10 mt-10">
            <CategoryNavigation
              activeCategorySlug={activeCategorySlug}
              activeSubcategorySlug={activeSubcategorySlug}
              query={filters.query}
              stateSlug={stateSlug}
              locale={filters.locale}
              countryCode={filters.countryCode}
              tree={categories}
            />
          </div>
          {invalidCategorySelection ? (
            <p className="relative z-10 mt-3 rounded-2xl border border-line bg-background px-4 py-3 text-sm font-medium text-brand" role="status">
              Categoría no disponible. Mostramos todos los productos.
            </p>
          ) : null}
          {filters.invalidAreaSelection ? (
            <p className="relative z-10 mt-3 rounded-2xl border border-line bg-background px-4 py-3 text-sm font-medium text-brand" role="status">
              Estado no disponible. Mostramos todo México.
            </p>
          ) : null}
        </div>
      </section>

      {hasFilters ? (
        <>
          {catalogSection}
          {shopsSection}
        </>
      ) : coldStart ? (
        <>
          <SellerPitch />
          {catalogSection}
          {shopsSection}
          {explorerSection}
          <TrustStrip />
          <BuyerSteps catalogHref="#catalogo" />
        </>
      ) : (
        <>
          {catalogSection}
          {shopsSection}
          {explorerSection}
          <BuyerSteps catalogHref="#catalogo" />
          <TrustStrip />
          <SellerPitch />
        </>
      )}
    </>
  );
}
