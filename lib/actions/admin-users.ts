"use server";

import { revalidatePath } from "next/cache";

import { formValues, type ActionState } from "@/lib/action-state";
import { deleteObjects } from "@/lib/media/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Raised by both account functions for the viewer's own account and for other administrators. */
const PROTECTED_ACCOUNT = "22023";
/** Raised by the delete function when someone else's records depend on the account. */
const ACCOUNT_HAS_HISTORY = "23503";

function parseUserId(value: FormDataEntryValue | null) {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function invalid(formData: FormData): ActionState {
  return {
    status: "error",
    message: "Datos de cuenta inválidos.",
    values: formValues(formData),
  };
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
    return {
      rejection: {
        status: "error",
        message: "Tu sesión terminó. Ingresa nuevamente.",
        values: formValues(formData),
      },
    };
  }

  const { data: allowed, error } = await supabase.rpc("is_current_user_admin");
  if (error || !allowed) {
    return {
      rejection: {
        status: "error",
        message: "No tienes permiso para administrar cuentas.",
        values: formValues(formData),
      },
    };
  }

  return { supabase };
}

// A disabled or deleted account takes its shops and listings out of the
// catalog, so every page and grid that showed them is stale.
function revalidateAccountPages(affected: { shop_slugs: string[]; product_slugs: string[] }) {
  for (const path of [
    "/",
    "/admin/usuarios",
    "/sitemap.xml",
    ...affected.shop_slugs.map((slug) => `/tiendas/${slug}`),
    ...affected.product_slugs.map((slug) => `/productos/${slug}`),
  ]) {
    revalidatePath(path);
  }
}

export async function setUserDisabled(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = parseUserId(formData.get("user_id"));
  const rawDisabled = formData.get("disabled");
  if (userId === null || (rawDisabled !== "true" && rawDisabled !== "false")) {
    return invalid(formData);
  }
  const disabled = rawDisabled === "true";

  const context = await administratorClient(formData);
  if ("rejection" in context) return context.rejection;

  const { data, error } = await context.supabase.rpc("set_user_disabled", {
    p_user_id: userId,
    p_disabled: disabled,
  });
  if (error || !data?.[0]) {
    return {
      status: "error",
      message:
        error?.code === PROTECTED_ACCOUNT
          ? "No puedes deshabilitar tu propia cuenta ni la de otra persona administradora."
          : "No pudimos actualizar la cuenta.",
      values: formValues(formData),
    };
  }

  revalidateAccountPages(data[0]);

  return {
    status: "success",
    message: disabled ? "Cuenta deshabilitada." : "Cuenta habilitada.",
    values: { disabled: String(disabled) },
  };
}

export async function deleteUser(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = parseUserId(formData.get("user_id"));
  if (userId === null) return invalid(formData);

  const context = await administratorClient(formData);
  if ("rejection" in context) return context.rejection;

  const { data, error } = await context.supabase.rpc("admin_delete_user", {
    p_user_id: userId,
  });
  if (error || !data?.[0]) {
    const message =
      error?.code === ACCOUNT_HAS_HISTORY
        ? "Esta cuenta tiene historial de pedidos o conversaciones. Deshabilítala en lugar de eliminarla."
        : error?.code === PROTECTED_ACCOUNT
          ? "No puedes eliminar tu propia cuenta ni la de otra persona administradora."
          : "No pudimos eliminar la cuenta.";

    return { status: "error", message, values: formValues(formData) };
  }

  // The database cascade does not reach the bucket; the function reported the
  // keys the account's shops and listings pointed at before it removed them.
  await deleteObjects(context.supabase, data[0].image_keys);
  revalidateAccountPages(data[0]);

  return { status: "success", message: "Cuenta eliminada." };
}
