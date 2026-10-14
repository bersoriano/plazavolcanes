"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  contactMessageSchema,
  visitorContactMessageSchema,
} from "@/lib/validation/contact-message";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Raised by the database when this hour's sends are spent. */
const RATE_LIMITED = "P0001";
/** Raised when the message to mark is not there. */
const NOT_FOUND = "P0002";

const RECEIVED: ActionState = {
  status: "success",
  message: "Recibimos tu mensaje. Te responderemos por correo o teléfono.",
};

const FAILED: ActionState = {
  status: "error",
  message: "No pudimos enviar tu mensaje. Intenta de nuevo.",
};

/**
 * A message to the plaza from /quejas-y-aclaraciones. A visitor leaves a name,
 * an email and a phone; a signed-in person only the message, and the database
 * takes the rest from the account whatever the form carried.
 */
export async function submitContactMessage(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // A person never sees this field. Whatever fills it is answered as if it
  // worked, so it learns nothing about what gave it away.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.trim() !== "") return RECEIVED;

  if (!isSupabaseConfigured()) return FAILED;

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const signedIn = Boolean(claims?.claims?.sub);

  let args: { p_message: string; p_name: string | null; p_email: string | null; p_phone: string | null };

  if (signedIn) {
    const parsed = contactMessageSchema.safeParse({ message: formData.get("message") });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Revisa los campos marcados.",
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    args = { p_message: parsed.data.message, p_name: null, p_email: null, p_phone: null };
  } else {
    const parsed = visitorContactMessageSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      message: formData.get("message"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Revisa los campos marcados.",
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    args = {
      p_message: parsed.data.message,
      p_name: parsed.data.name,
      p_email: parsed.data.email,
      p_phone: parsed.data.phone,
    };
  }

  const { data, error } = await supabase.rpc("submit_contact_message", args);
  if (error?.code === RATE_LIMITED) {
    return {
      status: "error",
      message: "Recibimos demasiados mensajes. Intenta de nuevo en un rato.",
    };
  }
  if (error || !data) return FAILED;

  revalidatePath("/admin/contacto");

  return RECEIVED;
}

/** Administration has answered a message, by email or by phone. */
export async function markContactMessageAttended(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const messageId = formData.get("message_id");
  if (typeof messageId !== "string" || !UUID.test(messageId)) {
    return { status: "error", message: "Mensaje inválido." };
  }

  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Servicio no configurado." };
  }

  // The database function repeats this check; doing it here first gives each
  // case its own message.
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };
  }

  const { data: allowed, error: adminError } = await supabase.rpc("is_current_user_admin");
  if (adminError || !allowed) {
    return { status: "error", message: "No tienes permiso para atender mensajes." };
  }

  const { error } = await supabase.rpc("mark_contact_message_attended", {
    p_message_id: messageId,
  });
  if (error) {
    return {
      status: "error",
      message: error.code === NOT_FOUND ? "No encontramos ese mensaje." : "No pudimos marcar el mensaje.",
    };
  }

  revalidatePath("/admin/contacto");

  return { status: "success", message: "Mensaje atendido." };
}
