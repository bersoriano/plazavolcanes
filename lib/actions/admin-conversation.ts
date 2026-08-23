"use server";

import { formValues, type ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminMessage = {
  id: number;
  sender_id: string;
  sender_label: string;
  body: string;
  created_at: string;
};

export type AdminReadState = ActionState & { messages?: AdminMessage[] };

export async function readConversationAsAdmin(
  conversationId: number,
  _previousState: AdminReadState,
  formData: FormData,
): Promise<AdminReadState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) {
    return {
      status: "error",
      message: "Escribe el motivo de la consulta.",
      values: formValues(formData),
    };
  }

  if (!isSupabaseConfigured()) return { status: "error", message: "Servicio no configurado." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("read_conversation_as_admin", {
    p_conversation_id: conversationId,
    p_reason: reason,
  });

  if (error) {
    return {
      status: "error",
      message: "No pudimos abrir la conversación.",
      values: formValues(formData),
    };
  }

  return { status: "success", message: "Consulta registrada.", messages: data ?? [] };
}
