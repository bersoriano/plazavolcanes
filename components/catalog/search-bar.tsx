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
    <form action="/" className="flex flex-wrap items-center gap-2 rounded-[1.5rem] border border-line bg-surface p-2 pl-5 shadow-[0_18px_55px_rgba(50,23,77,0.14)] sm:flex-nowrap sm:rounded-full" role="search">
      {categorySlug ? <input name="categoria" type="hidden" value={categorySlug} /> : null}
      {subcategorySlug ? <input name="subcategoria" type="hidden" value={subcategorySlug} /> : null}
      {locale && locale !== DEFAULT_CATALOG_LOCALE ? <input name="locale" type="hidden" value={locale} /> : null}
      {countryCode && countryCode !== DEFAULT_CATALOG_MARKET ? <input name="countryCode" type="hidden" value={countryCode} /> : null}
      <Search aria-hidden="true" className="size-5 shrink-0 text-brand" />
      <label className="sr-only" htmlFor="buscar-productos">Buscar productos</label>
      <input className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted" defaultValue={defaultValue} id="buscar-productos" name="q" placeholder="¿Qué estás buscando?" type="search" />
      <span aria-hidden="true" className="hidden h-7 w-px shrink-0 bg-line sm:block" />
      <div className="order-3 flex min-h-11 basis-full items-center gap-2 border-t border-line px-1 pt-2 text-brand sm:order-none sm:basis-auto sm:border-l sm:border-t-0 sm:pt-0">
        <MapPin aria-hidden="true" className="size-4" />
        <label className="sr-only" htmlFor="filtrar-estado">Estado</label>
        <select
          className="min-h-11 min-w-0 flex-1 cursor-pointer bg-transparent py-2 text-sm font-semibold text-brand outline-none sm:max-w-[10rem]"
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
