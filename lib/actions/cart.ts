"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkoutSchema, quantitySchema } from "@/lib/validation/commerce";

const sessionError: ActionState = { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };

async function authenticatedClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? supabase : null;
}

function databaseMessage(message: string | undefined, fallback: string) {
  if (message?.includes("propia tienda")) return "No puedes solicitar productos de tu propia tienda.";
  if (message?.includes("no están disponibles") || message?.includes("no disponible")) return "Uno o más productos ya no están disponibles.";
  if (message?.includes("carrito está vacío")) return "Tu carrito está vacío.";
  return fallback;
}

export async function addToCart(
  productId: number,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const quantity = quantitySchema.safeParse(formData.get("quantity"));
  if (!quantity.success) return { status: "error", message: quantity.error.issues[0]?.message ?? "Cantidad inválida." };
  const supabase = await authenticatedClient();
  if (!supabase) return sessionError;

  const { data: product } = await supabase.from("products").select("shop_id").eq("id", productId).eq("status", "published").maybeSingle();
  if (!product) return { status: "error", message: "Este producto ya no está disponible." };
  const { error } = await supabase.rpc("add_cart_item", { p_product_id: productId, p_quantity: quantity.data });
  if (error) return { status: "error", message: databaseMessage(error.message, "No pudimos agregar el producto.") };
  revalidatePath(`/carrito/${product.shop_id}`);
  redirect(`/carrito/${product.shop_id}`);
}

export async function setCartItemQuantity(itemId: number, formData: FormData) {
  const quantity = quantitySchema.safeParse(formData.get("quantity"));
  const supabase = await authenticatedClient();
  if (!quantity.success || !supabase) redirect("/ingresar");
  const { error } = await supabase.rpc("set_cart_item_quantity", { p_cart_item_id: itemId, p_quantity: quantity.data });
  if (error) throw new Error("No pudimos actualizar la cantidad.");
  revalidatePath("/carrito", "layout");
}

export async function removeCartItem(itemId: number) {
  const supabase = await authenticatedClient();
  if (!supabase) redirect("/ingresar");
  const { error } = await supabase.rpc("remove_cart_item", { p_cart_item_id: itemId });
  if (error) throw new Error("No pudimos quitar el producto.");
  revalidatePath("/carrito", "layout");
}

export async function checkoutCart(
  shopId: number,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = checkoutSchema.safeParse({
    recipient: formData.get("recipient"),
    address_line1: formData.get("address_line1"),
    address_line2: formData.get("address_line2"),
    locality: formData.get("locality"),
    administrative_area: formData.get("administrative_area"),
    postal_code: formData.get("postal_code"),
    country_code: formData.get("country_code"),
    delivery_instructions: formData.get("delivery_instructions"),
    buyer_note: formData.get("buyer_note"),
    idempotency_key: formData.get("idempotency_key"),
  });
  if (!parsed.success) return { status: "error", message: "Revisa los campos marcados.", errors: parsed.error.flatten().fieldErrors };
  const supabase = await authenticatedClient();
  if (!supabase) return sessionError;
  const { buyer_note, idempotency_key, ...address } = parsed.data;
  const { data: orderId, error } = await supabase.rpc("checkout_cart", {
    p_shop_id: shopId,
    p_address: address,
    p_buyer_note: buyer_note,
    p_idempotency_key: idempotency_key,
  });
  if (error || !orderId) return { status: "error", message: databaseMessage(error?.message, "No pudimos crear tu pedido.") };
  revalidatePath("/compras");
  redirect(`/compras/${orderId}?creado=1`);
}
