"use server";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { categorySuggestionSchema } from "@/lib/validation/category";

const authError: ActionState = {
  status: "error",
  message: "Tu sesión terminó. Ingresa nuevamente.",
};

async function getAuthenticatedContext() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  return userId ? { supabase, userId } : null;
}

async function isActiveProductRoot(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  categoryId: number,
) {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .is("parent_id", null)
    .eq("listing_type", "product")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error("No pudimos validar la categoría principal.");
  return Boolean(data);
}

export async function createCategorySuggestion(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = categorySuggestionSchema.safeParse({
    suggested_name: formData.get("suggested_name"),
    context: formData.get("context"),
    root_category_id: formData.get("root_category_id"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const context = await getAuthenticatedContext();
  if (!context) return authError;
  const { supabase, userId } = context;

  if (parsed.data.root_category_id !== null) {
    try {
      if (!(await isActiveProductRoot(supabase, parsed.data.root_category_id))) {
        return {
          status: "error",
          message: "Revisa los campos marcados.",
          errors: { root_category_id: ["Selecciona una categoría principal válida."] },
        };
      }
    } catch {
      return { status: "error", message: "No pudimos enviar la sugerencia." };
    }
  }

  const { error } = await supabase.from("category_suggestions").insert({
    ...parsed.data,
    seller_id: userId,
    locale: "es-MX",
    status: "pending",
  });
  if (error) return { status: "error", message: "No pudimos enviar la sugerencia." };

  return {
    status: "success",
    message: "Sugerencia enviada. La revisaremos antes de publicarla.",
  };
}
