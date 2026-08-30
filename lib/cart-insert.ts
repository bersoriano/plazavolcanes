import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type CartClient = SupabaseClient<Database>;

export type CartInsertResult =
  | { status: "added"; shopId: number }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export async function findAvailableProduct(supabase: CartClient, productId: number) {
  const { data } = await supabase
    .from("products")
    .select("shop_id, shops!inner(is_publishing_approved)")
    .eq("id", productId)
    .eq("status", "published")
    .eq("is_admin_enabled", true)
    .eq("shops.is_publishing_approved", true)
    .not("expires_at", "is", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return data;
}

/** Turns a database refusal into something a buyer can act on. */
export function databaseMessage(message: string | undefined, fallback: string) {
  if (message?.includes("propia tienda")) return "No puedes solicitar productos de tu propia tienda.";
  if (message?.includes("no están disponibles") || message?.includes("no disponible"))
    return "Uno o más productos ya no están disponibles.";
  if (message?.includes("carrito está vacío")) return "Tu carrito está vacío.";
  return fallback;
}

/**
 * Puts one published product in the signed-in buyer's cart for its shop.
 *
 * Both the direct "Solicitar compra" click and the resumed purchase after
 * sign-in end up here, so the availability check and the RPC call have one
 * definition rather than two that can drift.
 *
 * The shop is read from the product row, never from the caller: a buyer must
 * not be able to name the cart their item lands in.
 */
export async function insertCartItem(
  supabase: CartClient,
  productId: number,
  quantity: number,
): Promise<CartInsertResult> {
  const product = await findAvailableProduct(supabase, productId);

  if (!product) return { status: "unavailable" };

  const { error } = await supabase.rpc("add_cart_item", {
    p_product_id: productId,
    p_quantity: quantity,
  });

  if (error) {
    return { status: "error", message: databaseMessage(error.message, "No pudimos agregar el producto.") };
  }

  return { status: "added", shopId: product.shop_id };
}
