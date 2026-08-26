import Link from "next/link";

import { CategoryIcon } from "@/components/catalog/category-icon";
import {
  CATEGORY_ICON_BY_ROOT_SLUG,
  buildCatalogHref,
  type CategoryTree,
} from "@/lib/categories";
import type { CatalogLocale } from "@/lib/catalog-locale";

type CategoryNavigationProps = {
  tree: CategoryTree[];
  activeCategorySlug?: string;
  activeSubcategorySlug?: string;
  query?: string;
  stateSlug?: string;
  locale?: CatalogLocale;
  countryCode?: string;
};

export function CategoryNavigation({
  tree,
  activeCategorySlug,
  activeSubcategorySlug,
  query,
  stateSlug,
  locale,
  countryCode,
}: CategoryNavigationProps) {
  const activeCategory = tree.find((category) => category.slug === activeCategorySlug);
  const scrollGuidanceId = "category-scroll-guidance";

  return (
    <nav aria-label="Categorías de productos">
      <span className="sr-only" id={scrollGuidanceId}>Desliza para ver más categorías</span>
      <div className="relative">
        <div aria-describedby={scrollGuidanceId} className="flex gap-2 overflow-x-auto p-2 pr-10 [scrollbar-width:thin]">
          <Link
            aria-current={!activeCategory ? "page" : undefined}
            className={`relative flex min-h-11 min-w-[5.5rem] shrink-0 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition-colors ${
              !activeCategory
                ? "border border-brand bg-surface text-brand"
                : "border border-line bg-surface text-muted hover:border-brand hover:text-brand"
            }`}
            href={buildCatalogHref({ query, stateSlug, locale, countryCode })}
          >
            Todos
            {!activeCategory ? (
              <span aria-hidden="true" className="absolute inset-x-5 -bottom-0.5 h-1 rounded-full bg-accent" />
            ) : null}
          </Link>
          {tree.map((category) => {
            const isActive = category.slug === activeCategory?.slug;
            const iconName = CATEGORY_ICON_BY_ROOT_SLUG[
              category.slug as keyof typeof CATEGORY_ICON_BY_ROOT_SLUG
            ];

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-11 min-w-[8rem] shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border border-brand bg-surface text-brand"
                    : "border border-line bg-surface text-muted hover:border-brand hover:text-brand"
                }`}
                href={buildCatalogHref({ query, categorySlug: category.slug, stateSlug, locale, countryCode })}
                key={category.id}
              >
                {iconName ? <CategoryIcon aria-hidden="true" className="size-5 shrink-0" name={iconName} /> : null}
                <span className="whitespace-nowrap">{category.name}</span>
                {isActive ? (
                  <span aria-hidden="true" className="absolute inset-x-5 -bottom-0.5 h-1 rounded-full bg-accent" />
                ) : null}
              </Link>
            );
          })}
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
      </div>

      {activeCategory?.children.length ? (
        <div className="relative mt-3">
          <div aria-describedby={scrollGuidanceId} aria-label={`Subcategorías de ${activeCategory.name}`} className="flex gap-2 overflow-x-auto pb-2 pr-10">
            {activeCategory.children.map((subcategory) => {
              const isActive = subcategory.slug === activeSubcategorySlug;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-accent text-brand-hover"
                      : "border border-line bg-surface text-muted hover:border-brand hover:text-brand"
                  }`}
                  href={buildCatalogHref({
                    query,
                    categorySlug: activeCategory.slug,
                    subcategorySlug: subcategory.slug,
                    stateSlug,
                    locale,
                    countryCode,
                  })}
                  key={subcategory.id}
                >
                  {subcategory.name}
                </Link>
              );
            })}
          </div>
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
        </div>
      ) : null}
    </nav>
  );
}
