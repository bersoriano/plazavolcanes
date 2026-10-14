"use server";

import { revalidatePath } from "next/cache";

import { formValues, type ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  NOTICE_AUDIENCES,
  platformNoticeSchema,
  type NoticeAudience,
} from "@/lib/validation/platform-notice";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Raised when the person, the audience's members, or the send is not there. */
const NOT_FOUND = "P0002";

function parseUuid(value: FormDataEntryValue | null) {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function parseAudience(value: FormDataEntryValue | null): NoticeAudience | null {
  return NOTICE_AUDIENCES.find((audience) => audience === value) ?? null;
}

function refused(message: string, formData: FormData): ActionState {
  return { status: "error", message, values: formValues(formData) };
}

type AdminClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * The database functions repeat this check; doing it here first keeps a
 * signed-out or demoted person from ever reaching them and gives each case its
 * own message.
 */
async function administratorClient(
  formData: FormData,
): Promise<{ supabase: AdminClient } | { rejection: ActionState }> {
  if (!isSupabaseConfigured()) {
    return { rejection: { status: "error", message: "Servicio no configurado." } };
  }

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { rejection: refused("Tu sesión terminó. Ingresa nuevamente.", formData) };
  }

  const { data: allowed, error } = await supabase.rpc("is_current_user_admin");
  if (error || !allowed) {
    return { rejection: refused("No tienes permiso para enviar avisos.", formData) };
  }

  return { supabase };
}

// A send or a retraction changes administration's history, and every inbox it
// reached. The inbox list is rendered by the /mensajes layout.
function revalidateNotices() {
  revalidatePath("/admin/avisos");
  revalidatePath("/mensajes", "layout");
}

/**
 * Sends a notice to one person, or an announcement to an audience. The form
 * says which through `audience`; a person travels in `recipient_id`.
 */
export async function sendNotice(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const audience = parseAudience(formData.get("audience"));
  // An audience names no person, whatever else the form happened to carry.
  const recipientId = audience === "person" ? parseUuid(formData.get("recipient_id")) : null;
  if (audience === null || (audience === "person" && recipientId === null)) {
    return refused("Datos de aviso inválidos.", formData);
  }

  const parsed = platformNoticeSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    action_href: formData.get("action_href"),
    action_label: formData.get("action_label"),
  });
  if (!parsed.success) {
    return refused(parsed.error.issues[0]?.message ?? "Datos de aviso inválidos.", formData);
  }

  const context = await administratorClient(formData);
  if ("rejection" in context) return context.rejection;

  const { data, error } = await context.supabase.rpc("send_platform_notice", {
    p_audience: audience,
    p_recipient_id: recipientId,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_action_href: parsed.data.action_href,
    p_action_label: parsed.data.action_label,
  });
  if (error || !data?.[0]) {
    const message =
      error?.code !== NOT_FOUND
        ? "No pudimos enviar el aviso."
        : audience === "person"
          ? "No encontramos esa cuenta."
          : "No hay personas en esa audiencia.";

    return refused(message, formData);
  }

  revalidateNotices();

  const reached = data[0].recipient_count;

  return {
    status: "success",
    message:
      audience === "person"
        ? "Aviso enviado."
        : `Anuncio enviado a ${reached} ${reached === 1 ? "persona" : "personas"}.`,
  };
}

/** Takes a send back out of every inbox it reached. The history keeps it, marked. */
export async function retractNotice(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const batchId = parseUuid(formData.get("batch_id"));
  if (batchId === null) return refused("Datos de aviso inválidos.", formData);

  const context = await administratorClient(formData);
  if ("rejection" in context) return context.rejection;

  const { error } = await context.supabase.rpc("retract_platform_notice", {
    p_batch_id: batchId,
  });
  if (error) {
    return refused(
      error.code === NOT_FOUND ? "No encontramos ese envío." : "No pudimos retirar el aviso.",
      formData,
    );
  }

  revalidateNotices();

  return { status: "success", message: "Aviso retirado." };
}

/**
 * Opening a notice reads it. The database only ever marks the caller's own, so
 * the number needs no checking here.
 */
export async function markPlatformNoticeRead(noticeId: number) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createServerSupabaseClient();
  // Read state is a convenience. A failure here must never break a notice.
  await supabase.rpc("mark_platform_notice_read", { p_notice_id: noticeId });
}
