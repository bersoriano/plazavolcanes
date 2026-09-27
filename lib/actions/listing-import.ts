"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { parseImportLinks } from "@/lib/listing-import";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function client() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

export async function requestListingImport(shopId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const text = String(formData.get("links") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 500);
  const parsed = parseImportLinks(text);
  if ("error" in parsed) return { status: "error", message: parsed.error, values: { links: text, note } };

  const supabase = await client();
  if (!supabase) return { status: "error", message: "Tu sesión terminó." };

  const { error } = await supabase.rpc("request_listing_import", {
    p_shop_id: shopId,
    p_links: parsed.links,
    p_note: note || null,
  });
  if (error) {
    return {
      status: "error",
      message: error.code === "P0001" || error.code === "22023" ? error.message : "No pudimos enviar tu solicitud.",
      values: { links: text, note },
    };
  }

  revalidatePath(`/panel/tiendas/${shopId}`);
  revalidatePath("/admin/importaciones");
  return { status: "success", message: "Recibimos tus enlaces. Aquí verás cuando tus borradores estén listos." };
}

export async function completeImportRequest(requestId: number) {
  const supabase = await client();
  if (!supabase) return;
  await supabase.rpc("complete_import_request", { p_request_id: requestId });
  revalidatePath("/admin/importaciones");
}
