import "server-only";

import type { OrderStatus } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapOrderDetailRow, type OrderDetailRow } from "@/lib/queries/orders";

import type { CartDetail, OrderDetail, OrderSummary } from "@/lib/queries/orders.types";

export type { CartDetail, OrderSummary, OrderDetail } from "@/lib/queries/orders.types";

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
    .select("id, shops!inner(id, name, slug), cart_items(id, quantity, products!inner(id, name, price_mxn, image_path))")
    .eq("buyer_id", userId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as { id: number; shops: CartDetail["shop"]; cart_items: { id: number; quantity: number; products: CartDetail["items"][number]["product"] }[] };
  const items = row.cart_items.map((item) => ({ id: item.id, quantity: item.quantity, product: item.products }));
  return { id: row.id, shop: row.shops, items, subtotal: items.reduce((sum, item) => sum + item.product.price_mxn * item.quantity, 0) };
}

async function getOrders(scope: "buyer" | "seller"): Promise<OrderSummary[]> {
  const context = await clientAndUser();
  if (!context) return [];
  const { supabase, userId } = context;
  let query = supabase.from("orders").select("id, status, subtotal, currency_code, created_at, shops!inner(id, name, slug, owner_id)");
  query = scope === "buyer" ? query.eq("buyer_id", userId) : query.eq("shops.owner_id", userId);
  const { data } = await query.order("created_at", { ascending: false });
  return ((data ?? []) as unknown as { id: number; status: OrderStatus; subtotal: number; currency_code: string; created_at: string; shops: OrderSummary["shop"] }[]).map((row) => ({ ...row, shop: row.shops }));
}

export const getBuyerOrders = () => getOrders("buyer");
export const getSellerOrders = () => getOrders("seller");

export async function getOrderDetail(orderId: number): Promise<OrderDetail | null> {
  const context = await clientAndUser();
  if (!context) return null;
  const { data } = await context.supabase
    .from("orders")
    .select("id, buyer_id, status, subtotal, currency_code, buyer_note, handling_days, handling_time_zone, payment_confirmation_required, payment_completed_at, seller_cancellation_reason, accepted_at, ship_by_at, shipped_at, delivered_at, completed_at, tracking_text, created_at, shops!inner(id, name, slug), order_items(id, product_name, unit_price, quantity, line_total), order_addresses(recipient, address_line1, address_line2, locality, administrative_area, postal_code, country_code, delivery_instructions, redacted_at), order_events(id, event_type, previous_status, next_status, created_at), conversations(id, messages(id, sender_id, body, created_at)), order_reviews(id, rating, matched_description, comment, created_at), order_disputes(id, reason, status, buyer_statement, seller_response, resolution, resolution_notes, seller_fault, opened_at)")
    .eq("id", orderId)
    .maybeSingle();

  return mapOrderDetailRow(data as unknown as OrderDetailRow | null, context.userId);
}
