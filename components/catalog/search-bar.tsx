import { Search } from "lucide-react";

import {
  DEFAULT_CATALOG_LOCALE,
  DEFAULT_CATALOG_MARKET,
  type CatalogLocale,
} from "@/lib/catalog-locale";

type SearchBarProps = {
  defaultValue?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  locale?: CatalogLocale;
  countryCode?: string;
};

export function SearchBar({
  defaultValue = "",
  categorySlug,
  subcategorySlug,
  locale,
  countryCode,
}: SearchBarProps) {
  return (
    <form action="/" className="flex items-center gap-2 rounded-full border border-line bg-surface p-2 pl-5 shadow-[0_18px_55px_rgba(50,23,77,0.14)]" role="search">
      {categorySlug ? <input name="categoria" type="hidden" value={categorySlug} /> : null}
      {subcategorySlug ? <input name="subcategoria" type="hidden" value={subcategorySlug} /> : null}
      {locale && locale !== DEFAULT_CATALOG_LOCALE ? <input name="locale" type="hidden" value={locale} /> : null}
      {countryCode && countryCode !== DEFAULT_CATALOG_MARKET ? <input name="countryCode" type="hidden" value={countryCode} /> : null}
      <Search aria-hidden="true" className="size-5 shrink-0 text-brand" />
      <label className="sr-only" htmlFor="buscar-productos">Buscar productos</label>
      <input className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted" defaultValue={defaultValue} id="buscar-productos" name="q" placeholder="¿Qué estás buscando?" type="search" />
      <button aria-label="Buscar" className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-hover" type="submit">
        <Search aria-hidden="true" className="size-5" />
      </button>
    </form>
  );
}
