import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { CATALOG_TABS, type CatalogCounts, type CatalogTab } from "@/lib/seller-catalog";

const TAB_LABELS: Record<CatalogTab, string> = {
  todos: "Todos",
  publicados: "Publicados",
  borradores: "Borradores",
  vencidos: "Vencidos",
  bloqueados: "Bloqueados",
};

export function catalogHref(shopId: number, tab: CatalogTab, search: string): string {
  const params = new URLSearchParams();
  if (tab !== "todos") params.set("estado", tab);
  if (search) params.set("buscar", search);
  const query = params.toString();
  return `/panel/tiendas/${shopId}${query ? `?${query}` : ""}`;
}

export function CatalogToolbar({
  shopId,
  tab,
  search,
  counts,
}: {
  shopId: number;
  tab: CatalogTab;
  search: string;
  counts: CatalogCounts;
}) {
  // An administration block is the exception, not a standing state; its tab
  // appears only once there is something behind it to look at.
  const tabs = CATALOG_TABS.filter((name) => name !== "bloqueados" || counts.bloqueados > 0);

  return (
    <div className="border-b border-line pb-5">
      <nav aria-label="Estado de las publicaciones" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {tabs.map((name) => {
            const isOpen = name === tab;

            return (
              <li key={name}>
                <Link
                  aria-current={isOpen ? "page" : undefined}
                  className={`tap inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    isOpen
                      ? "bg-brand text-white"
                      : "border border-line bg-surface text-brand hover:border-brand"
                  }`}
                  href={catalogHref(shopId, name, search)}
                >
                  {/* A real space, not the flex gap: without it the tab's
                      accessible name runs together as "Vencidos2". */}
                  {TAB_LABELS[name]}{" "}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                      isOpen ? "bg-white/20 text-white" : "bg-background text-muted"
                    }`}
                  >
                    {counts[name]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* A plain GET form: the filtered catalogue becomes a URL, so it
            survives a refresh, a back button and an edit-and-return. */}
        <form action={`/panel/tiendas/${shopId}`} className="relative flex-1" method="get" role="search">
          {tab === "todos" ? null : <input name="estado" type="hidden" value={tab} />}
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            aria-label="Buscar producto"
            className="tap w-full rounded-full border border-line bg-surface py-2 pl-11 pr-4 text-sm placeholder:text-muted"
            defaultValue={search}
            name="buscar"
            placeholder="Buscar producto…"
            type="search"
          />
        </form>
        <Link
          className="tap inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          href={`/panel/tiendas/${shopId}/productos/nuevo`}
        >
          <Plus aria-hidden="true" className="size-4" />
          Agregar producto
        </Link>
      </div>
    </div>
  );
}
