"use server";

import { revalidatePath } from "next/cache";

import { formValues, type ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function parseShopId(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function parseEnabled(value: FormDataEntryValue | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export async function setShopPublishingApproval(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shopId = parseShopId(formData.get("shop_id"));
  const enabled = parseEnabled(formData.get("enabled"));
  if (shopId === null || enabled === null) {
    return {
      status: "error",
      message: "Datos de aprobación inválidos.",
      values: formValues(formData),
    };
  }

  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Servicio no configurado." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return {
      status: "error",
      message: "Tu sesión terminó. Ingresa nuevamente.",
      values: formValues(formData),
    };
  }

  const { data: allowed, error: authorizationError } = await supabase.rpc(
    "is_current_user_admin",
  );
  if (authorizationError || !allowed) {
    return {
      status: "error",
      message: "No tienes permiso para administrar publicaciones.",
      values: formValues(formData),
    };
  }

  const { data, error } = await supabase.rpc("set_shop_publishing_approval", {
    p_shop_id: shopId,
    p_enabled: enabled,
  });
  if (error || !data?.[0]) {
    return {
      status: "error",
      message: "No pudimos actualizar la aprobación de publicaciones.",
      values: formValues(formData),
    };
  }

  const affected = data[0];
  for (const path of [
    "/",
    "/admin/usuarios",
    `/tiendas/${affected.shop_slug}`,
    ...affected.product_slugs.map((slug) => `/productos/${slug}`),
    "/sitemap.xml",
    `/panel/tiendas/${affected.shop_id}`,
  ]) {
    revalidatePath(path);
  }

  return {
    status: "success",
    message: enabled ? "Publicaciones habilitadas." : "Publicaciones pendientes.",
    values: { enabled: String(enabled) },
  };
}
