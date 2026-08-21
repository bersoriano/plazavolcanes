import { MapPin, Search } from "lucide-react";

import {
  DEFAULT_CATALOG_LOCALE,
  DEFAULT_CATALOG_MARKET,
  type CatalogLocale,
} from "@/lib/catalog-locale";
import { MEXICO_ADMINISTRATIVE_AREAS } from "@/lib/shop-location";

type SearchBarProps = {
  defaultValue?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  stateSlug?: string;
  locale?: CatalogLocale;
  countryCode?: string;
};

export function SearchBar({
  defaultValue = "",
  categorySlug,
  subcategorySlug,
  stateSlug,
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
      <span aria-hidden="true" className="hidden h-7 w-px shrink-0 bg-line sm:block" />
      <div className="hidden shrink-0 items-center gap-1.5 pr-1 text-brand sm:flex">
        <MapPin aria-hidden="true" className="size-4" />
        <label className="sr-only" htmlFor="filtrar-estado">Estado</label>
        <select
          className="min-w-0 max-w-[10rem] cursor-pointer truncate bg-transparent py-3 text-sm font-semibold text-brand outline-none"
          defaultValue={stateSlug ?? ""}
          id="filtrar-estado"
          name="estado"
        >
          <option value="">Todo México</option>
          {MEXICO_ADMINISTRATIVE_AREAS.map((area) => (
            <option key={area.code} value={area.slug}>{area.label}</option>
          ))}
        </select>
      </div>
      <button aria-label="Buscar" className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-hover" type="submit">
        <Search aria-hidden="true" className="size-5" />
      </button>
    </form>
  );
}
