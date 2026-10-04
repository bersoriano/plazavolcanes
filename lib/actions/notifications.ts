"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * The seller's "Avisos por correo" switch. The sender reads it when an email is
 * about to go out, so switching off also stops emails already queued.
 */
export async function updateEmailNotifications(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { status: "error", message: "Servicio no configurado." };

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };

  const enabled = formData.get("email_enabled") === "on";
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, email_enabled: enabled, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { status: "error", message: "No pudimos guardar tus avisos." };

  revalidatePath("/panel/cuenta");
  return { status: "success", message: enabled ? "Te avisaremos por correo." : "Ya no te enviaremos avisos por correo." };
}
