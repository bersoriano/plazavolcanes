import { Search } from "lucide-react";

export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/" className="flex items-center gap-2 rounded-full border border-line bg-surface p-2 pl-5 shadow-[0_18px_55px_rgba(50,23,77,0.14)]" role="search">
      <Search aria-hidden="true" className="size-5 shrink-0 text-brand" />
      <label className="sr-only" htmlFor="buscar-productos">Buscar productos</label>
      <input className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted" defaultValue={defaultValue} id="buscar-productos" name="q" placeholder="¿Qué estás buscando?" type="search" />
      <button aria-label="Buscar" className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-hover" type="submit">
        <Search aria-hidden="true" className="size-5" />
      </button>
    </form>
  );
}
