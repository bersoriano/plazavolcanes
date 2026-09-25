import { CategoryNavigation } from "@/components/catalog/category-navigation";
import { SearchBar } from "@/components/catalog/search-bar";
import type { CatalogLocale } from "@/lib/catalog-locale";
import type { CategoryTree } from "@/lib/categories";

type CatalogSearchPanelProps = {
  tree: CategoryTree[];
  query?: string;
  locale?: CatalogLocale;
  countryCode?: string;
};

/**
 * The plaza's index on the home page: the search and the category row in one
 * card that overlaps the bottom of the hero. The hero's bottom padding is sized
 * to this overlap, so the two change together.
 */
export function CatalogSearchPanel({ tree, query, locale, countryCode }: CatalogSearchPanelProps) {
  return (
    <section
      aria-label="Buscar en la plaza"
      className="relative z-10 -mt-[84px] px-4 sm:px-8 lg:-mt-[104px]"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3.5 rounded-[1.625rem] border border-line bg-surface p-4 shadow-[0_30px_60px_-36px] shadow-brand-hover/45 sm:gap-5 sm:p-6 lg:gap-[22px] lg:rounded-[2rem] lg:px-8 lg:py-7 lg:shadow-[0_40px_80px_-44px] lg:shadow-brand-hover/40">
        <SearchBar countryCode={countryCode} defaultValue={query} locale={locale} variant="panel" />
        <CategoryNavigation
          countryCode={countryCode}
          locale={locale}
          query={query}
          tree={tree}
          variant="panel"
        />
      </div>
    </section>
  );
}
