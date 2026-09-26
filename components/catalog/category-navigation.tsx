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
  /** `panel` is the home buyer panel: text-only pill chips on white, a wider fade. */
  variant?: "default" | "panel";
};

/** Root chip classes per variant: [base, active, idle]. */
const ROOT_CHIP = {
  default: [
    "relative flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-colors",
    "border border-brand bg-surface text-brand",
    "border border-line bg-surface text-muted hover:border-brand hover:text-brand",
  ],
  panel: [
    "relative flex h-11 shrink-0 items-center rounded-full px-4 text-[14px] transition-colors sm:px-[18px] sm:text-[15px]",
    "border-[1.5px] border-brand bg-accent font-bold text-brand",
    "border border-line bg-surface font-semibold text-ink hover:border-brand",
  ],
} as const;

export function CategoryNavigation({
  tree,
  activeCategorySlug,
  activeSubcategorySlug,
  query,
  stateSlug,
  locale,
  countryCode,
  variant = "default",
}: CategoryNavigationProps) {
  const activeCategory = tree.find((category) => category.slug === activeCategorySlug);
  const scrollGuidanceId = "category-scroll-guidance";
  const panel = variant === "panel";
  const [chipBase, chipActive, chipIdle] = ROOT_CHIP[variant];
  // The default look underlines the active chip in accent; the panel fills it.
  const activeRule = panel ? null : (
    <span aria-hidden="true" className="absolute inset-x-5 -bottom-0.5 h-1 rounded-full bg-accent" />
  );

  return (
    <nav aria-label="Categorías de productos">
      <span className="sr-only" id={scrollGuidanceId}>Desliza para ver más categorías</span>
      {/* On a phone the panel row runs to the card's edges, so the chips
          scroll out under the fade instead of stopping at the padding. */}
      <div className={panel ? "relative -mx-4 sm:mx-0" : "relative"}>
        <div
          aria-describedby={scrollGuidanceId}
          className={
            panel
              ? "flex gap-2 overflow-x-auto px-4 py-1 pr-16 [scrollbar-width:thin] sm:gap-2.5 sm:px-1 sm:pr-24"
              : "flex gap-2 overflow-x-auto p-2 pr-10 [scrollbar-width:thin]"
          }
        >
          <Link
            aria-current={!activeCategory ? "page" : undefined}
            className={`${chipBase} ${panel ? "" : "min-w-[5.5rem]"} ${!activeCategory ? chipActive : chipIdle}`}
            href={buildCatalogHref({ query, stateSlug, locale, countryCode })}
          >
            Todos
            {!activeCategory ? activeRule : null}
          </Link>
          {tree.map((category) => {
            const isActive = category.slug === activeCategory?.slug;
            const iconName = CATEGORY_ICON_BY_ROOT_SLUG[
              category.slug as keyof typeof CATEGORY_ICON_BY_ROOT_SLUG
            ];

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`${chipBase} ${panel ? "" : "min-w-[8rem]"} ${isActive ? chipActive : chipIdle}`}
                href={buildCatalogHref({ query, categorySlug: category.slug, stateSlug, locale, countryCode })}
                key={category.id}
              >
                {iconName && !panel ? <CategoryIcon aria-hidden="true" className="size-5 shrink-0" name={iconName} /> : null}
                <span className="whitespace-nowrap">{category.name}</span>
                {isActive ? activeRule : null}
              </Link>
            );
          })}
        </div>
        <span
          aria-hidden="true"
          className={
            panel
              ? "pointer-events-none absolute inset-y-0 right-0 w-[72px] bg-linear-to-l from-surface from-15% to-surface/0 sm:w-[120px] sm:from-20%"
              : "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
          }
        />
      </div>

      {activeCategory?.children.length ? (
        <div className="relative mt-3">
          <div aria-describedby={scrollGuidanceId} aria-label={`Subcategorías de ${activeCategory.name}`} className="flex gap-2 overflow-x-auto p-2 pr-10">
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
