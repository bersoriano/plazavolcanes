import "server-only";

import type { OrderStatus } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CartDetail = {
  id: number;
  shop: { id: number; name: string; slug: string };
  items: { id: number; quantity: number; product: { id: number; name: string; price_mxn: number; image_path: string | null } }[];
  subtotal: number;
};

export type OrderSummary = {
  id: number;
  status: OrderStatus;
  subtotal: number;
  currency_code: string;
  created_at: string;
  shop: { id: number; name: string; slug: string };
};

export type OrderDetail = OrderSummary & {
  buyer_id: string;
  current_user_id: string;
  viewer_role: "buyer" | "seller";
  buyer_note: string | null;
  handling_days: number;
  handling_time_zone: string;
  accepted_at: string | null;
  ship_by_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  tracking_text: string | null;
  items: { id: number; product_name: string; unit_price: number; quantity: number; line_total: number }[];
  address: { recipient: string | null; address_line1: string | null; address_line2: string | null; locality: string | null; administrative_area: string | null; postal_code: string | null; country_code: string | null; delivery_instructions: string | null; redacted_at: string | null } | null;
  events: { id: number; event_type: string; previous_status: string | null; next_status: string; created_at: string }[];
  conversation: { id: number; messages: { id: number; sender_id: string; body: string; created_at: string }[] } | null;
};

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
    .select("id, buyer_id, status, subtotal, currency_code, buyer_note, handling_days, handling_time_zone, accepted_at, ship_by_at, shipped_at, delivered_at, completed_at, tracking_text, created_at, shops!inner(id, name, slug), order_items(id, product_name, unit_price, quantity, line_total), order_addresses(recipient, address_line1, address_line2, locality, administrative_area, postal_code, country_code, delivery_instructions, redacted_at), order_events(id, event_type, previous_status, next_status, created_at), conversations(id, messages(id, sender_id, body, created_at))")
    .eq("id", orderId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Omit<OrderDetail, "shop" | "items" | "address" | "events" | "conversation" | "current_user_id" | "viewer_role"> & { shops: OrderDetail["shop"]; order_items: OrderDetail["items"]; order_addresses: OrderDetail["address"][]; order_events: OrderDetail["events"]; conversations: { id: number; messages: { id: number; sender_id: string; body: string; created_at: string }[] }[] };
  const conversation = row.conversations[0] ?? null;
  return { ...row, current_user_id: context.userId, viewer_role: row.buyer_id === context.userId ? "buyer" : "seller", shop: row.shops, items: row.order_items, address: row.order_addresses[0] ?? null, events: [...row.order_events].sort((a, b) => a.created_at.localeCompare(b.created_at)), conversation: conversation ? { ...conversation, messages: [...conversation.messages].sort((a, b) => a.created_at.localeCompare(b.created_at)) } : null };
}
