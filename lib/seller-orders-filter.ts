/**
 * What the seller's orders page is narrowed to, read from and written back to
 * its address, so a filtered view can be bookmarked, shared or reloaded and
 * works without JavaScript. Mirrors the catalogue's `?estado=…&buscar=…`.
 */

export const ORDER_TABS = ["todos", "actuar", "comprador", "cerrados"] as const;

export type OrderTab = (typeof ORDER_TABS)[number];

export type SellerOrdersFilter = {
  tab: OrderTab;
  search: string;
  /** One of the seller's shops, or every shop. */
  shopId: number | null;
  /** How many closed orders to load; open ones always load in full. */
  closedLimit: number;
};

export type SellerOrderCounts = Record<OrderTab, number>;

/** Closed orders arrive this many at a time. */
export const CLOSED_PAGE_SIZE = 20;

/** Far enough back for any seller today, short enough for one read. */
const MAX_CLOSED = 500;

const SEARCH_MAX_LENGTH = 80;

type QueryValue = string | string[] | undefined;

function single(value: QueryValue) {
  return typeof value === "string" ? value : "";
}

export function parseSellerOrdersFilter(query: Record<string, QueryValue>): SellerOrdersFilter {
  const tabValue = single(query.estado);
  const tab = (ORDER_TABS as readonly string[]).includes(tabValue) ? (tabValue as OrderTab) : "todos";

  const shopNumber = Number(single(query.tienda));
  const shopId = Number.isSafeInteger(shopNumber) && shopNumber > 0 ? shopNumber : null;

  const requested = Number(single(query.cerrados));
  const pages = Number.isFinite(requested) && requested > 0 ? Math.ceil(requested / CLOSED_PAGE_SIZE) : 1;
  const closedLimit = Math.min(Math.max(pages, 1) * CLOSED_PAGE_SIZE, MAX_CLOSED);

  return { tab, search: single(query.buscar).trim().slice(0, SEARCH_MAX_LENGTH), shopId, closedLimit };
}

export type OrderSearchTerm = { kind: "order"; id: number } | { kind: "product"; pattern: string };

/**
 * A number is an order number, `#12` included; anything else is part of a
 * product name. The ILIKE pattern escapes its own wildcards, so "50%" means
 * fifty percent rather than "50 and anything after".
 */
export function orderSearchTerm(search: string): OrderSearchTerm | null {
  const text = search.trim();
  const digits = text.replace(/^#/, "");
  if (!digits) return null;
  if (/^\d+$/.test(digits)) {
    const id = Number(digits);
    if (Number.isSafeInteger(id) && id > 0) return { kind: "order", id };
  }
  return { kind: "product", pattern: `%${text.replace(/[\\%_]/g, (match) => `\\${match}`)}%` };
}

export function sellerOrdersHref(filter: SellerOrdersFilter): string {
  const params = new URLSearchParams();
  if (filter.tab !== "todos") params.set("estado", filter.tab);
  if (filter.search) params.set("buscar", filter.search);
  if (filter.shopId !== null) params.set("tienda", String(filter.shopId));
  if (filter.closedLimit !== CLOSED_PAGE_SIZE) params.set("cerrados", String(filter.closedLimit));
  const query = params.toString();
  return `/panel/pedidos${query ? `?${query}` : ""}`;
}

export function isFiltered(filter: SellerOrdersFilter) {
  return filter.search !== "" || filter.shopId !== null || filter.tab !== "todos";
}

/** "Florero ×2 y 1 producto más": what was ordered, at a glance. */
export function describeOrderItems(items: { product_name: string; quantity: number }[]): string {
  const [first, ...rest] = items;
  if (!first) return "Productos no disponibles";
  const lead = first.quantity > 1 ? `${first.product_name} ×${first.quantity}` : first.product_name;
  if (!rest.length) return lead;
  return `${lead} y ${rest.length} ${rest.length === 1 ? "producto más" : "productos más"}`;
}
