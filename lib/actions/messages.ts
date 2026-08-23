"use server";

import { revalidatePath } from "next/cache";

import { formValues, type ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { messageBodySchema } from "@/lib/validation/message";

/** Refusals the database writes for a person to read, passed through as they are. */
const USER_FACING_CODES = new Set(["P0001", "22023"]);

function readableError(error: { code?: string; message: string }, fallback: string) {
  return USER_FACING_CODES.has(error.code ?? "") ? error.message : fallback;
}

export async function sendMessage(
  conversationId: number,
  revalidate: string[],
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = messageBodySchema.safeParse(formData.get("body"));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Mensaje inválido.",
      values: formValues(formData),
    };
  }

  if (!isSupabaseConfigured()) return { status: "error", message: "Servicio no configurado." };

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return {
      status: "error",
      message: "Tu sesión terminó. Ingresa nuevamente.",
      values: formValues(formData),
    };
  }

  // A fresh key per submit. Generating it during render meant a second message
  // could reuse the first one's key, and the server answers a repeated key with
  // the message it already stored — so the second one vanished silently.
  const { error } = await supabase.rpc("send_conversation_message", {
    p_conversation_id: conversationId,
    p_body: parsed.data,
    p_idempotency_key: crypto.randomUUID(),
  });

  if (error) {
    return {
      status: "error",
      message: readableError(error, "No pudimos enviar el mensaje."),
      values: formValues(formData),
    };
  }

  for (const path of revalidate) revalidatePath(path);

  return { status: "success", message: "Mensaje enviado." };
}

export async function startPreSaleConversation(
  shopId: number,
): Promise<{ conversationId: number } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "Servicio no configurado." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("start_pre_sale_conversation", { p_shop_id: shopId });

  if (error) return { error: readableError(error, "No pudimos abrir la conversación.") };

  return { conversationId: data };
}

export async function markConversationRead(conversationId: number, lastMessageId: number) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createServerSupabaseClient();
  // Read state is a convenience. A failure here must never break a thread.
  await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
    p_last_message_id: lastMessageId,
  });
}
