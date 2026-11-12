import Link from "next/link";
import { ArrowRight, SearchX, Store } from "lucide-react";

import { AppliedSearchFilters } from "@/components/catalog/applied-search-filters";
import { CategoryNavigation } from "@/components/catalog/category-navigation";
import { ProductCard } from "@/components/catalog/product-card";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SearchBar } from "@/components/catalog/search-bar";
import { PublicShopCard, ShopInviteCard } from "@/components/catalog/shop-card";
import { BuyerSteps } from "@/components/home/buyer-steps";
import { StateExplorer } from "@/components/home/state-explorer";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { buildCatalogHref } from "@/lib/categories";
import { formatProductCondition } from "@/lib/product-condition";
import { hasCatalogSearch, type CatalogFilters } from "@/lib/queries/catalog";
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
  const stateSlug = area?.slug ?? filters.administrativeAreaSlug;
  const catalogHref = buildCatalogHref({
    criteria: filters.criteria,
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
  const broaderHref = filters.criteria?.waterproof === true
    ? buildCatalogHref({
        ...filters, stateSlug, criteria: { ...filters.criteria, waterproof: undefined },
        categorySlug: activeCategorySlug, subcategorySlug: activeSubcategorySlug,
      })
    : undefined;
  const categoryNameById = new Map(
    categories.flatMap((category) => [
      [category.id, category.name] as const,
      ...category.children.map((subcategory) => [subcategory.id, subcategory.name] as const),
    ]),
  );
  // The state scopes the page rather than filtering within it, so it never counts here.
  const hasFilters = Boolean(hasCatalogSearch(filters) || activeCategorySlug);
  // Only /explorar shows the whole plaza unfiltered; its heading keeps the
  // larger size the home catalogue used to have.
  const allProducts =
    !area && !hasFilters && !invalidCategorySelection && !filters.invalidAreaSelection;
  const placeSuffix = area ? ` en ${area.label}` : "";
  const heading = filters.query
    ? activeCategoryName
      ? `Productos para “${filters.query}” en ${activeCategoryName}`
      : `Productos para “${filters.query}”`
    : activeCategoryName
      ? `Productos de ${activeCategoryName}${placeSuffix}`
      : hasFilters ? `Resultados de búsqueda${placeSuffix}`
        : area ? `Recién publicado en ${area.label}` : "Descubrimientos de la plaza";
  const activeCriteria = [
    filters.criteria?.condition ? formatProductCondition(filters.criteria.condition, filters.criteria.grade ?? null) : null,
    filters.criteria?.min !== undefined ? `desde ${filters.criteria.min} MXN` : null,
    filters.criteria?.max !== undefined ? `hasta ${filters.criteria.max} MXN` : null,
    filters.criteria?.waterproof === true ? "impermeable" : null,
    filters.criteria?.waterproof === false ? "no impermeable" : null,
  ].filter(Boolean).join(", ");

  const catalogSection = (
    <section
      aria-labelledby="catalogo-heading"
      className="scroll-mt-[76px] px-5 pb-16 pt-6 sm:px-8 lg:pb-[104px] lg:pt-10"
      id="catalogo"
      tabIndex={-1}
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-6 flex flex-col gap-3.5 lg:mb-12 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-3.5 lg:gap-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand lg:text-[13px]">
              {hasFilters ? "Resultados" : "Recién publicados"}
            </p>
            <h2
              className={`text-balance font-display font-medium leading-[1.02] tracking-[-0.03em] text-ink ${
                allProducts ? "text-[38px] lg:text-[60px]" : "text-[32px] lg:text-[48px]"
              }`}
              id="catalogo-heading"
            >
              {allProducts ? (
                <>
                  Descubrimientos <em className="italic text-brand">de la plaza.</em>
                </>
              ) : (
                heading
              )}
            </h2>
          </div>
          <nav aria-label="Vistas del catálogo" className="mt-1 flex flex-wrap gap-2 lg:mt-0">
            {hasFilters ? (
              <ButtonLink variant="unstyled" className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-brand lg:px-[18px]" href={resetHref}>
                Limpiar filtros
              </ButtonLink>
            ) : (
              <Badge variant="unstyled" className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-bold text-brand-hover lg:px-[18px]">
                Todos
              </Badge>
            )}
            {!filters.query && (
              <Badge variant="unstyled" className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-muted lg:px-[18px]">
                Más recientes
              </Badge>
            )}
            <ButtonLink variant="unstyled" className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-brand lg:px-[18px]" href="#tiendas">
              Tiendas
            </ButtonLink>
          </nav>
        </div>
        <AppliedSearchFilters filters={filters} />
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
                <Link className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4" href={broaderHref ?? (hasFilters ? resetHref : "/explorar")}>
                  {broaderHref ? "Buscar sin exigir impermeabilidad" : hasFilters ? "Ampliar búsqueda" : "Ver todos los anuncios"}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              }
              description={
                filters.searchError ?? (broaderHref
                  ? "No encontramos coincidencias con impermeabilidad indicada por el vendedor."
                  : hasFilters
                  ? `No hay productos disponibles${activeCategoryName ? ` en ${activeCategoryName}` : ""}${area ? ` en ${area.label}` : ""}${filters.query ? ` para “${filters.query}”` : ""}${activeCriteria ? ` con filtro ${activeCriteria}` : ""}. Amplía la búsqueda para ver más anuncios.`
                  : area
                    ? `Todavía no hay productos disponibles en ${area.label}.`
                    : "Todavía no hay productos disponibles. Vuelve pronto para ver nuevos anuncios.")
              }
              icon={hasFilters ? <SearchX aria-hidden="true" className="size-7" /> : <Store aria-hidden="true" className="size-7" />}
              title={filters.searchError ? "Revisa tu búsqueda" : hasFilters ? "No encontramos productos" : "Aún no hay productos publicados"}
            />
          )}
        </ProductGrid>
      </div>
    </section>
  );

  const shopsSection = shops.length ? (
    <section aria-labelledby="tiendas-heading" className="pb-16 lg:px-8 lg:pb-[104px]" id="tiendas">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 lg:gap-10">
        <div className="flex flex-col gap-3.5 px-5 sm:px-8 lg:gap-4 lg:px-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand lg:text-[13px]">
            Conoce a quienes venden
          </p>
          <h2
            className="text-balance font-display text-[36px] font-medium leading-[1.04] tracking-[-0.03em] text-ink lg:text-[48px]"
            id="tiendas-heading"
          >
            {area ? (
              `Tiendas de ${area.label}`
            ) : (
              <>
                Tiendas <em className="italic text-brand">de la plaza.</em>
              </>
            )}
          </h2>
        </div>
        {/* A scroller on a phone, a three-column grid at lg: the scroller
            dissolves into the grid, so the invite card becomes its last cell. */}
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3">
          <div className="flex snap-x gap-3.5 overflow-x-auto scroll-px-5 px-5 pb-1 sm:scroll-px-8 sm:px-8 lg:contents">
            {shops.slice(0, 8).map((shop) => <PublicShopCard key={shop.id} shop={shop} />)}
          </div>
          {hasFilters ? null : <ShopInviteCard />}
        </div>
      </div>
    </section>
  ) : null;

  const explorerSection =
    !area && !hasFilters && stateCounts?.length ? <StateExplorer counts={stateCounts as CatalogStateCount[]} /> : null;

  return (
    <>
      <section className="border-b border-line bg-surface px-5 pb-5 pt-6 sm:px-8 lg:py-9">
        <div className="mx-auto max-w-[1200px]">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-brand sm:text-4xl">
            {area ? `Productos en ${area.label}` : "Explora productos disponibles"}
          </h1>
          <p className="mt-2 text-sm text-muted">Busca por producto, categoría o estado.</p>
          <div className="mt-5 max-w-2xl">
            <SearchBar
              availableStateCodes={stateCounts?.filter((entry) => entry.count > 0).map((entry) => entry.code)}
              categorySlug={activeCategorySlug}
              defaultValue={filters.originalQuery ?? filters.query}
              criteria={filters.criteria}
              subcategorySlug={activeSubcategorySlug}
              stateSlug={stateSlug}
              locale={filters.locale}
              countryCode={filters.countryCode}
            />
          </div>
          <div className="mt-5">
            <CategoryNavigation
              activeCategorySlug={activeCategorySlug}
              activeSubcategorySlug={activeSubcategorySlug}
              query={filters.query}
              criteria={filters.criteria}
              stateSlug={stateSlug}
              locale={filters.locale}
              countryCode={filters.countryCode}
              tree={categories}
            />
          </div>
          {invalidCategorySelection ? <p className="mt-3 text-sm text-muted" role="status">Categoría no disponible. Mostramos todos los productos.</p> : null}
          {filters.invalidAreaSelection ? <p className="mt-3 text-sm text-muted" role="status">Estado no disponible. Mostramos todo México.</p> : null}
        </div>
      </section>

      {catalogSection}
      {shopsSection}
      {explorerSection}
      <BuyerSteps catalogHref="#catalogo" />
    </>
  );
}
