"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sellerCancellationSchema, shipmentSchema, transitionSchema } from "@/lib/validation/order-events";

export type OrderTransition = "accept" | "reject" | "ship" | "receive" | "complete";

export async function transitionOrder(
  orderId: number,
  transition: OrderTransition,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let idempotencyKey: string;
  let trackingText: string | null = null;
  if (transition === "ship") {
    const shipment = shipmentSchema.safeParse({ tracking_text: formData.get("tracking_text"), idempotency_key: formData.get("idempotency_key") });
    if (!shipment.success) return { status: "error", message: "Revisa los datos de la acción." };
    idempotencyKey = shipment.data.idempotency_key;
    trackingText = shipment.data.tracking_text;
  } else {
    const stateChange = transitionSchema.safeParse({ idempotency_key: formData.get("idempotency_key") });
    if (!stateChange.success) return { status: "error", message: "Revisa los datos de la acción." };
    idempotencyKey = stateChange.data.idempotency_key;
  }
  if (!isSupabaseConfigured()) return { status: "error", message: "Servicio no configurado." };
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };

  const result = transition === "accept"
    ? await supabase.rpc("accept_order", { p_order_id: orderId, p_idempotency_key: idempotencyKey })
    : transition === "reject"
      ? await supabase.rpc("reject_order", { p_order_id: orderId, p_idempotency_key: idempotencyKey })
      : transition === "ship"
        ? await supabase.rpc("mark_order_shipped", { p_order_id: orderId, p_tracking_text: trackingText, p_idempotency_key: idempotencyKey })
        : transition === "receive"
          ? await supabase.rpc("confirm_order_received", { p_order_id: orderId, p_idempotency_key: idempotencyKey })
          : await supabase.rpc("confirm_order_satisfied", { p_order_id: orderId, p_idempotency_key: idempotencyKey });

  if (result.error) return { status: "error", message: result.error.message };
  revalidatePath(`/compras/${orderId}`);
  revalidatePath(`/panel/pedidos/${orderId}`);
  revalidatePath("/compras");
  revalidatePath("/panel/pedidos");
  return { status: "success", message: "Estado actualizado." };
}

async function authenticatedOrderClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? supabase : null;
}

function revalidateOrder(orderId: number) {
  revalidatePath(`/compras/${orderId}`);
  revalidatePath(`/panel/pedidos/${orderId}`);
  revalidatePath("/compras");
  revalidatePath("/panel/pedidos");
}

export async function confirmOrderPayment(orderId: number, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = transitionSchema.safeParse({ idempotency_key: formData.get("idempotency_key") });
  if (!parsed.success) return { status: "error", message: "Revisa los datos de la acción." };
  const supabase = await authenticatedOrderClient();
  if (!supabase) return { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };
  const { error } = await supabase.rpc("confirm_order_payment", { p_order_id: orderId, p_idempotency_key: parsed.data.idempotency_key });
  if (error) return { status: "error", message: error.message };
  revalidateOrder(orderId);
  return { status: "success", message: "Pago confirmado." };
}

export async function cancelOrderAsBuyer(orderId: number, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = transitionSchema.safeParse({ idempotency_key: formData.get("idempotency_key") });
  if (!parsed.success) return { status: "error", message: "Revisa los datos de la acción." };
  const supabase = await authenticatedOrderClient();
  if (!supabase) return { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };
  const { error } = await supabase.rpc("cancel_order_by_buyer", { p_order_id: orderId, p_idempotency_key: parsed.data.idempotency_key });
  if (error) return { status: "error", message: error.message };
  revalidateOrder(orderId);
  return { status: "success", message: "Pedido cancelado." };
}

export async function cancelOrderAsSeller(orderId: number, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = sellerCancellationSchema.safeParse({ reason: formData.get("reason"), idempotency_key: formData.get("idempotency_key") });
  if (!parsed.success) return { status: "error", message: "Selecciona una razón válida." };
  const supabase = await authenticatedOrderClient();
  if (!supabase) return { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };
  const { error } = await supabase.rpc("cancel_order_by_seller", {
    p_order_id: orderId,
    p_reason: parsed.data.reason,
    p_idempotency_key: parsed.data.idempotency_key,
  });
  if (error) return { status: "error", message: error.message };
  revalidateOrder(orderId);
  return { status: "success", message: "Pedido cancelado." };
}
