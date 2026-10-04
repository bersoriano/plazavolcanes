import Link from "next/link";
import { Search } from "lucide-react";

import {
  CLOSED_PAGE_SIZE,
  ORDER_TABS,
  sellerOrdersHref,
  type OrderTab,
  type SellerOrderCounts,
  type SellerOrdersFilter,
} from "@/lib/seller-orders-filter";

const TAB_LABELS: Record<OrderTab, string> = {
  todos: "Todos",
  actuar: "Te toca actuar",
  comprador: "Esperando al comprador",
  cerrados: "Cerrados",
};

/**
 * Tabs, search and shop picker for the seller's orders. Plain links and a GET
 * form: every view has its own address and works without JavaScript. A tab
 * keeps the search and shop, and starts history from its first page again.
 */
export function SellerOrdersToolbar({
  filter,
  counts,
  shops,
}: {
  filter: SellerOrdersFilter;
  counts: SellerOrderCounts;
  shops: { id: number; name: string }[];
}) {
  return (
    <div className="mt-8 border-b border-line pb-5">
      <nav aria-label="Filtrar pedidos" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {ORDER_TABS.map((tab) => {
            const active = tab === filter.tab;
            return (
              <li key={tab}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`tap inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                    active ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-brand hover:border-brand"
                  }`}
                  href={sellerOrdersHref({ ...filter, tab, closedLimit: CLOSED_PAGE_SIZE })}
                >
                  {TAB_LABELS[tab]}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-on-brand/15" : "bg-background"}`}>{counts[tab]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/panel/pedidos" className="mt-4 flex flex-wrap gap-3" method="get" role="search">
        {filter.tab !== "todos" ? <input name="estado" type="hidden" value={filter.tab} /> : null}
        <label className="relative min-w-0 flex-1 basis-60">
          <span className="sr-only">Buscar pedido</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            className="min-h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
            defaultValue={filter.search}
            maxLength={80}
            name="buscar"
            placeholder="Número de pedido o producto"
            type="search"
          />
        </label>
        {shops.length > 1 ? (
          <label className="min-w-0">
            <span className="sr-only">Tienda</span>
            <select
              className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm text-ink focus:border-brand focus:outline-none"
              defaultValue={filter.shopId === null ? "" : String(filter.shopId)}
              name="tienda"
            >
              <option value="">Todas las tiendas</option>
              {shops.map((shop) => (
                <option key={shop.id} value={String(shop.id)}>
                  {shop.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button className="tap inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-on-brand" type="submit">
          Buscar
        </button>
      </form>
    </div>
  );
}
