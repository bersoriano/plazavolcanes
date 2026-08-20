"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { messageSchema } from "@/lib/validation/order-events";

export async function sendMessage(
  conversationId: number,
  orderId: number,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = messageSchema.safeParse({ body: formData.get("body"), idempotency_key: formData.get("idempotency_key") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Mensaje inválido." };
  if (!isSupabaseConfigured()) return { status: "error", message: "Servicio no configurado." };
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };
  const { error } = await supabase.rpc("send_conversation_message", {
    p_conversation_id: conversationId,
    p_body: parsed.data.body,
    p_idempotency_key: parsed.data.idempotency_key,
  });
  if (error) return { status: "error", message: "No pudimos enviar el mensaje." };
  revalidatePath(`/compras/${orderId}`);
  revalidatePath(`/panel/pedidos/${orderId}`);
  return { status: "success", message: "Mensaje enviado." };
}
