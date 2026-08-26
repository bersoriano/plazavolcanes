"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { databaseMessage, insertCartItem } from "@/lib/cart-insert";
import { savePurchaseIntent } from "@/lib/purchase-intent.server";
import { safeContinuation } from "@/lib/safe-continuation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkoutSchema, quantitySchema } from "@/lib/validation/commerce";

const sessionError: ActionState = { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };
const setupError: ActionState = {
  status: "error",
  message: "El acceso no está configurado todavía. Inténtalo más tarde.",
};

async function authenticatedClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? supabase : null;
}

export async function addToCart(
  productId: number,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const quantity = quantitySchema.safeParse(formData.get("quantity"));
  if (!quantity.success) {
    return { status: "error", message: quantity.error.issues[0]?.message ?? "Cantidad inválida." };
  }

  if (!isSupabaseConfigured()) return setupError;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  // A first-time visitor has no session to have lost. Remember what they were
  // buying and send them to sign in; the purchase finishes itself afterwards.
  if (typeof data?.claims?.sub !== "string") {
    await savePurchaseIntent({
      productId,
      quantity: quantity.data,
      productPath: safeContinuation(formData.get("producto")),
    });
    redirect("/ingresar");
  }

  const result = await insertCartItem(supabase, productId, quantity.data);

  if (result.status === "unavailable") {
    return { status: "error", message: "Este producto ya no está disponible." };
  }

  if (result.status === "error") {
    return { status: "error", message: result.message };
  }

  revalidatePath(`/carrito/${result.shopId}`);
  redirect(`/carrito/${result.shopId}`);
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
  const { data: orderId, error } = await supabase.rpc("checkout_cart_v2", {
    p_shop_id: shopId,
    p_address: address,
    p_buyer_note: buyer_note,
    p_idempotency_key: idempotency_key,
  });
  if (error || !orderId) return { status: "error", message: databaseMessage(error?.message, "No pudimos crear tu pedido.") };
  revalidatePath("/compras");
  redirect(`/compras/${orderId}?creado=1`);
}
