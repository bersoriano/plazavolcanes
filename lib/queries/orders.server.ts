import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapOrderDetailRow, type OrderDetailRow } from "@/lib/queries/orders";

import type { BuyerOrderRow, CartDetail, OrderDetail, SellerOrderQueue, SellerOrderRow } from "@/lib/queries/orders.types";
import { MEDIA_VARIANTS, mediaUrls } from "@/lib/media/url";

export type { BuyerOrderRow, CartDetail, OrderSummary, OrderDetail, SellerOrderQueue, SellerOrderRow } from "@/lib/queries/orders.types";

const ORDER_PROGRESS_COLUMNS =
  "fulfillment_method, payment_confirmation_required, payment_completed_at, ship_by_at, delivered_at, handling_time_zone";

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

type SellerOrderQueueRow = Omit<SellerOrderRow, "shop"> & { shops: SellerOrderRow["shop"] & { owner_id: string } };

/**
 * Every order placed in the seller's own shops, with what the orders page
 * needs to say whose move it is. Row-level security also returns the orders
 * this person placed as a buyer; the owner filter is what keeps them out.
 * A failed read is reported, never shown as "no orders yet".
 */
export async function getSellerOrderQueue({ now = new Date() }: { now?: Date } = {}): Promise<SellerOrderQueue | null> {
  const context = await clientAndUser();
  if (!context) return null;
  const { supabase, userId } = context;
  const { data, error } = await supabase
    .from("orders")
    .select(`id, status, subtotal, currency_code, created_at, ${ORDER_PROGRESS_COLUMNS}, shops!inner(id, name, slug, owner_id)`)
    .eq("shops.owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { status: "error" };

  const orders = ((data ?? []) as unknown as SellerOrderQueueRow[])
    .filter((row) => row.shops.owner_id === userId)
    .map(({ shops, ...row }) => ({ ...row, shop: { id: shops.id, name: shops.name, slug: shops.slug } }));
  return { status: "ready", now, orders };
}

export async function getOrderDetail(orderId: number): Promise<OrderDetail | null> {
  const context = await clientAndUser();
  if (!context) return null;
  const { data } = await context.supabase
    .from("orders")
    .select("id, buyer_id, status, subtotal, currency_code, buyer_note, fulfillment_method, alt_contact_name, alt_contact_phone, alt_contact_note, handling_days, handling_time_zone, payment_confirmation_required, payment_completed_at, seller_cancellation_reason, accepted_at, ship_by_at, shipped_at, delivered_at, completed_at, tracking_text, created_at, shops!inner(id, name, slug), order_items(id, product_name, unit_price, quantity, line_total), order_addresses(recipient, address_line1, address_line2, locality, administrative_area, postal_code, country_code, delivery_instructions, redacted_at), order_events(id, event_type, previous_status, next_status, created_at), conversations(id, messages(id, sender_id, body, created_at)), order_reviews(id, rating, matched_description, comment, created_at), order_disputes(id, reason, status, buyer_statement, seller_response, resolution, resolution_notes, seller_fault, opened_at)")
    .eq("id", orderId)
    .maybeSingle();

  return mapOrderDetailRow(data as unknown as OrderDetailRow | null, context.userId);
}
