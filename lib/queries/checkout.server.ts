import "server-only";

import { displayNameOrHandle } from "@/lib/display-name";
import { oldestFirst } from "@/lib/queries/messages";
import type { ThreadMessage } from "@/lib/queries/messages";
import {
  parsePickupPoint,
  PICKUP_POINT_READ_ERROR,
  type PickupPoint,
} from "@/lib/queries/checkout";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CartThread = {
  productId: number;
  productName: string;
  conversationId: number | null;
  messages: ThreadMessage[];
};

export async function fetchPickupPoint(shopId: number): Promise<PickupPoint | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("shop_pickup_point", { p_shop_id: shopId });
  if (error) throw new Error(PICKUP_POINT_READ_ERROR);
  if (data === null) return null;

  const pickupPoint = parsePickupPoint(data);
  if (!pickupPoint) throw new Error(PICKUP_POINT_READ_ERROR);
  return pickupPoint;
}

/**
 * The threads for what is in the cart, read and never created.
 *
 * Opening a conversation is a write, and a page render is a GET: a crawler
 * following the cart link must not open threads on a shopper's behalf. A product
 * with no thread yet comes back with a null conversation id, and the panel offers
 * to start one.
 */
export async function fetchCartThreads(
  shopId: number,
  items: { productId: number; productName: string }[],
): Promise<CartThread[]> {
  if (!isSupabaseConfigured() || items.length === 0) return [];
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return [];

  // Row-level security already limits this to the caller's own conversations.
  const { data } = await supabase
    .from("conversations")
    .select("id, product_id, messages(id, sender_id, body, created_at)")
    .eq("shop_id", shopId)
    .eq("type", "pre_sale")
    .in("product_id", items.map((item) => item.productId));

  const rows = (data ?? []) as unknown as {
    id: number;
    product_id: number | null;
    messages: ThreadMessage[];
  }[];
  const byProduct = new Map(rows.filter((row) => row.product_id !== null).map((row) => [row.product_id, row]));

  return items.map((item) => {
    const row = byProduct.get(item.productId);
    return {
      productId: item.productId,
      productName: item.productName,
      conversationId: row?.id ?? null,
      messages: row ? oldestFirst(row.messages) : [],
    };
  });
}

export async function fetchBuyerProfile() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return null;

  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : null;
  const [{ data: contact }, { data: name }] = await Promise.all([
    supabase.from("user_contact_details").select("phone").eq("user_id", userId).maybeSingle(),
    supabase.rpc("my_display_name"),
  ]);

  return {
    userId,
    displayName: displayNameOrHandle(name ?? null, userId),
    email,
    phone: contact?.phone ?? null,
  };
}
