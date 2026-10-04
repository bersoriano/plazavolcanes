import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapOrderDetailRow, type OrderDetailRow } from "@/lib/queries/orders";

import type { BuyerOrderRow, CartDetail, OrderDetail, SellerOrderQueue, SellerOrderRow } from "@/lib/queries/orders.types";
import { MEDIA_VARIANTS, mediaUrls } from "@/lib/media/url";
import { sellerOrderStep } from "@/lib/seller-action-queue";
import {
  orderSearchTerm,
  parseSellerOrdersFilter,
  type SellerOrderCounts,
  type SellerOrdersFilter,
} from "@/lib/seller-orders-filter";

export type { BuyerOrderRow, CartDetail, OrderSummary, OrderDetail, SellerOrderItem, SellerOrderQueue, SellerOrderRow } from "@/lib/queries/orders.types";

const ORDER_PROGRESS_COLUMNS =
  "fulfillment_method, payment_confirmation_required, payment_completed_at, ship_by_at, delivered_at, decide_by_at, handling_time_zone";

async function clientAndUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return userId ? { supabase, userId } : null;
}

export async function getCart(shopId: number): Promise<CartDetail | null> {
  const context = await clientAndUser();
  if (!context) return null;
  const { supabase, userId } = context;
  const { data } = await supabase
    .from("carts")
    .select("id, shops!inner(id, name, slug), cart_items(id, product_id, quantity, products(id, name, price_mxn, image_path, units_available, currency_code))")
    .eq("buyer_id", userId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    id: number;
    shops: CartDetail["shop"];
    cart_items: {
      id: number;
      product_id: number;
      quantity: number;
      products: Omit<NonNullable<CartDetail["items"][number]["product"]>, "image_url"> | null;
    }[];
  };
  // Resolved here rather than in the page: the cart is the surface where a
  // buyer checks they picked the right thing, so a row without its picture is
  // an incomplete cart rather than a page-level styling choice.
  const imageUrls = mediaUrls(
    row.cart_items.map((item) => item.products?.image_path),
    MEDIA_VARIANTS.thumbnail,
  );
  const items = row.cart_items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    quantity: item.quantity,
    product: item.products
      ? {
          ...item.products,
          image_url: item.products.image_path
            ? (imageUrls.get(item.products.image_path) ?? null)
            : null,
        }
      : null,
  }));
  return {
    id: row.id,
    shop: row.shops,
    items,
    subtotal: items.reduce(
      (sum, item) => sum + (item.product ? item.product.price_mxn * item.quantity : 0),
      0,
    ),
  };
}

/** The buyer's own purchases, with what it takes to say what each is waiting for. */
export async function getBuyerOrders(): Promise<BuyerOrderRow[]> {
  const context = await clientAndUser();
  if (!context) return [];
  const { supabase, userId } = context;
  const { data } = await supabase
    .from("orders")
    .select(`id, status, subtotal, currency_code, created_at, ${ORDER_PROGRESS_COLUMNS}, shops!inner(id, name, slug)`)
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as (Omit<BuyerOrderRow, "shop"> & { shops: BuyerOrderRow["shop"] })[]).map(({ shops, ...row }) => ({ ...row, shop: shops }));
}

const OPEN_ORDER_STATUSES = ["requested", "accepted", "shipped", "delivered"] as const;

const SELLER_ORDER_COLUMNS = `id, status, subtotal, currency_code, created_at, shop_id, ${ORDER_PROGRESS_COLUMNS}, order_items(id, product_name, quantity, products(image_path))`;

/** How many orders a product-name search may point at; far beyond any shop today. */
const SEARCH_MATCH_LIMIT = 500;

type SellerOrderQueueRow = Omit<SellerOrderRow, "shop" | "items"> & {
  shop_id: number;
  order_items: { id: number; product_name: string; quantity: number; products: { image_path: string | null } | null }[] | null;
};

const emptyCounts: SellerOrderCounts = { todos: 0, actuar: 0, comprador: 0, cerrados: 0 };

/**
 * The seller's orders page: every open order, a page of closed ones, and the
 * counts its tabs show — narrowed to one shop and a search when asked.
 *
 * Row-level security also returns the orders this person placed as a buyer,
 * so every read is pinned to the ids of shops they own; a shop id in the
 * address that is not theirs is ignored rather than trusted. Open orders are
 * few and each needs something, so they always load in full; closed ones
 * load a page at a time, with one extra row read to know whether there is
 * more. Nothing about the buyer is selected. A failed read is reported,
 * never shown as "no orders yet".
 */
export async function getSellerOrderQueue({
  now = new Date(),
  filter = parseSellerOrdersFilter({}),
}: { now?: Date; filter?: SellerOrdersFilter } = {}): Promise<SellerOrderQueue | null> {
  const context = await clientAndUser();
  if (!context) return null;
  const { supabase, userId } = context;

  const { data: shopRows, error: shopsError } = await supabase
    .from("shops")
    .select("id, name, slug")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  if (shopsError) return { status: "error" };
  const shops = (shopRows ?? []) as { id: number; name: string; slug: string }[];
  const shopById = new Map(shops.map((shop) => [shop.id, shop]));
  const scope = filter.shopId !== null && shopById.has(filter.shopId) ? [filter.shopId] : shops.map((shop) => shop.id);
  const ready = (orders: SellerOrderRow[], counts: SellerOrderCounts, hasMoreClosed: boolean): SellerOrderQueue => ({
    status: "ready",
    now,
    orders,
    shops: shops.map(({ id, name }) => ({ id, name })),
    counts,
    hasMoreClosed,
  });
  if (!scope.length) return ready([], emptyCounts, false);

  let matchingIds: number[] | null = null;
  const term = orderSearchTerm(filter.search);
  if (term?.kind === "order") matchingIds = [term.id];
  if (term?.kind === "product") {
    const { data, error } = await supabase
      .from("order_items")
      .select("order_id, orders!inner(shop_id)")
      .ilike("product_name", term.pattern)
      .in("orders.shop_id", scope)
      .limit(SEARCH_MATCH_LIMIT);
    if (error) return { status: "error" };
    matchingIds = [...new Set(((data ?? []) as { order_id: number }[]).map((row) => row.order_id))];
  }
  if (matchingIds && !matchingIds.length) return ready([], emptyCounts, false);

  const openStatuses = `(${OPEN_ORDER_STATUSES.join(",")})`;
  const scoped = <Q extends { in: (column: string, values: readonly unknown[]) => Q }>(query: Q) => {
    const inShops = query.in("shop_id", scope);
    return matchingIds ? inShops.in("id", matchingIds) : inShops;
  };
  const listsClosed = filter.tab === "todos" || filter.tab === "cerrados";

  const [openResult, closedResult, closedCount] = await Promise.all([
    scoped(supabase.from("orders").select(SELLER_ORDER_COLUMNS))
      .in("status", [...OPEN_ORDER_STATUSES])
      .order("created_at", { ascending: false }),
    listsClosed
      ? scoped(supabase.from("orders").select(SELLER_ORDER_COLUMNS))
          .not("status", "in", openStatuses)
          .order("created_at", { ascending: false })
          .range(0, filter.closedLimit)
      : Promise.resolve({ data: [], error: null }),
    scoped(supabase.from("orders").select("id", { count: "exact", head: true })).not("status", "in", openStatuses),
  ]);
  if (openResult.error || closedResult.error || closedCount.error) return { status: "error" };

  const openRows = (openResult.data ?? []) as unknown as SellerOrderQueueRow[];
  const closedRows = (closedResult.data ?? []) as unknown as SellerOrderQueueRow[];
  const pageOfClosed = closedRows.slice(0, filter.closedLimit);
  const imageUrls = mediaUrls(
    [...openRows, ...pageOfClosed].flatMap((row) => (row.order_items ?? []).map((item) => item.products?.image_path)),
    MEDIA_VARIANTS.thumbnail,
  );
  const toSellerRow = ({ shop_id, order_items, ...row }: SellerOrderQueueRow): SellerOrderRow | null => {
    const shop = shopById.get(shop_id);
    if (!shop) return null;
    const items = [...(order_items ?? [])]
      .sort((left, right) => left.id - right.id)
      .map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        image_url: item.products?.image_path ? (imageUrls.get(item.products.image_path) ?? null) : null,
      }));
    return { ...row, shop, items };
  };
  const open = openRows.map(toSellerRow).filter((row): row is SellerOrderRow => row !== null);
  const closed = pageOfClosed.map(toSellerRow).filter((row): row is SellerOrderRow => row !== null);

  const actuar = open.filter((order) => sellerOrderStep(order).owner === "seller").length;
  const comprador = open.length - actuar;
  const cerrados = closedCount.count ?? closed.length;

  return ready(
    [...open, ...closed],
    { todos: open.length + cerrados, actuar, comprador, cerrados },
    listsClosed && closedRows.length > filter.closedLimit,
  );
}

export async function getOrderDetail(orderId: number): Promise<OrderDetail | null> {
  const context = await clientAndUser();
  if (!context) return null;
  const { data } = await context.supabase
    .from("orders")
    .select("id, buyer_id, status, subtotal, currency_code, buyer_note, fulfillment_method, alt_contact_name, alt_contact_phone, alt_contact_note, handling_days, handling_time_zone, payment_confirmation_required, payment_completed_at, seller_cancellation_reason, accepted_at, decide_by_at, ship_by_at, shipped_at, delivered_at, completed_at, tracking_text, created_at, shops!inner(id, name, slug), order_items(id, product_name, unit_price, quantity, line_total), order_addresses(recipient, address_line1, address_line2, locality, administrative_area, postal_code, country_code, delivery_instructions, redacted_at), order_events(id, event_type, previous_status, next_status, created_at), conversations(id, messages(id, sender_id, body, created_at)), order_reviews(id, rating, matched_description, comment, created_at), order_disputes(id, reason, status, buyer_statement, seller_response, resolution, resolution_notes, seller_fault, opened_at)")
    .eq("id", orderId)
    .maybeSingle();

  return mapOrderDetailRow(data as unknown as OrderDetailRow | null, context.userId);
}
