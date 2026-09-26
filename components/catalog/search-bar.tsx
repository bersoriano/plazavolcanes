import { ChevronDown, MapPin, Search } from "lucide-react";

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
  /**
   * `panel` is the home page's buyer panel: a 72px cream pill with the state and
   * the submit button inside it, the two dropping to their own row on phones.
   */
  variant?: "default" | "panel";
};

export function SearchBar({
  defaultValue = "",
  categorySlug,
  subcategorySlug,
  stateSlug,
  locale,
  countryCode,
  variant = "default",
}: SearchBarProps) {
  const hiddenFields = (
    <>
      {categorySlug ? <input name="categoria" type="hidden" value={categorySlug} /> : null}
      {subcategorySlug ? <input name="subcategoria" type="hidden" value={subcategorySlug} /> : null}
      {locale && locale !== DEFAULT_CATALOG_LOCALE ? <input name="locale" type="hidden" value={locale} /> : null}
      {countryCode && countryCode !== DEFAULT_CATALOG_MARKET ? <input name="countryCode" type="hidden" value={countryCode} /> : null}
    </>
  );
  const stateOptions = (
    <>
      <option value="">Todo México</option>
      {MEXICO_ADMINISTRATIVE_AREAS.map((area) => (
        <option key={area.code} value={area.slug}>{area.label}</option>
      ))}
    </>
  );

  if (variant === "panel") {
    return (
      // One grid for both shapes. From sm row one is the cream pill holding the
      // field, the state and the button. On a phone the pill holds the field
      // alone, and the state and the button share row two.
      <form
        action="/"
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-3.5 sm:gap-y-0"
        role="search"
      >
        {hiddenFields}
        <span
          aria-hidden="true"
          className="col-span-full row-start-1 h-14 rounded-full border-[1.5px] border-line bg-background transition-colors group-has-[#buscar-productos:focus-visible]:border-brand sm:h-[72px]"
        />
        <div className="col-span-full row-start-1 flex min-w-0 items-center gap-2.5 px-[18px] sm:col-span-1 sm:col-start-1 sm:gap-3.5 sm:pl-6 sm:pr-0">
          <Search aria-hidden="true" className="size-5 shrink-0 text-muted sm:size-[22px]" />
          <label className="sr-only" htmlFor="buscar-productos">Buscar productos</label>
          <input className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted sm:text-[18px]" defaultValue={defaultValue} id="buscar-productos" name="q" placeholder="¿Qué estás buscando?" type="search" />
        </div>
        <div className="relative col-start-1 row-start-2 flex h-[52px] items-center gap-2 rounded-full border border-line bg-surface px-[18px] text-ink has-[select:focus-visible]:border-brand sm:col-start-2 sm:row-start-1 sm:h-14 sm:px-5">
          <MapPin aria-hidden="true" className="size-[18px] shrink-0 text-brand" />
          <label className="sr-only" htmlFor="filtrar-estado">Estado</label>
          <select
            className="min-h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-5 text-[15px] font-semibold text-ink outline-none sm:max-w-[10rem] sm:text-base"
            defaultValue={stateSlug ?? ""}
            id="filtrar-estado"
            name="estado"
          >
            {stateOptions}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 size-4 shrink-0" strokeWidth={2.2} />
        </div>
        <button aria-label="Buscar" className="col-start-2 row-start-2 grid size-[52px] place-items-center rounded-full bg-brand text-accent transition-colors hover:bg-brand-hover sm:col-start-3 sm:row-start-1 sm:mr-2 sm:size-14" type="submit">
          <Search aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
        </button>
      </form>
    );
  }

  return (
    <form action="/" className="flex flex-wrap items-center gap-2 rounded-[1.5rem] border border-line bg-surface p-2 pl-5 shadow-[0_18px_55px_rgba(50,23,77,0.14)] sm:flex-nowrap sm:rounded-full" role="search">
      {hiddenFields}
      <Search aria-hidden="true" className="size-5 shrink-0 text-brand" />
      <label className="sr-only" htmlFor="buscar-productos">Buscar productos</label>
      <input className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted" defaultValue={defaultValue} id="buscar-productos" name="q" placeholder="¿Qué estás buscando?" type="search" />
      <div className="order-3 flex min-h-11 basis-full items-center gap-2 border-t border-line px-1 pt-2 text-brand sm:order-none sm:basis-auto sm:border-l sm:border-t-0 sm:pt-0">
        <MapPin aria-hidden="true" className="size-4" />
        <label className="sr-only" htmlFor="filtrar-estado">Estado</label>
        <select
          className="min-h-11 min-w-0 flex-1 cursor-pointer bg-transparent py-2 text-sm font-semibold text-brand outline-none sm:max-w-[10rem]"
          defaultValue={stateSlug ?? ""}
          id="filtrar-estado"
          name="estado"
        >
          {stateOptions}
        </select>
      </div>
      <button aria-label="Buscar" className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-hover" type="submit">
        <Search aria-hidden="true" className="size-5" />
      </button>
    </form>
  );
}
