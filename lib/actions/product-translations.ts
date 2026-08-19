"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { productTranslationSchema } from "@/lib/validation/product-translation";

const saveError: ActionState = {
  status: "error",
  message: "No pudimos guardar la versión en inglés.",
};

function revalidateTranslationPaths(productId: number, shopId: number, shopSlug: string) {
  revalidatePath("/");
  revalidatePath(`/productos/${productId}`);
  revalidatePath(`/tiendas/${shopSlug}`);
  revalidatePath(`/panel/productos/${productId}/editar`);
  revalidatePath(`/panel/tiendas/${shopId}`);
}

export async function saveEnglishProductTranslation(
  productId: number,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productTranslationSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors ?? undefined,
    };
  }

  if (!isSupabaseConfigured()) return saveError;
  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return saveError;

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("shop_id")
    .eq("id", productId)
    .maybeSingle();
  if (productError || !product) return saveError;

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id, slug")
    .eq("id", product.shop_id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (shopError || !shop) return saveError;

  if (parsed.data === null) {
    const { error } = await supabase
      .from("product_translations")
      .delete()
      .eq("product_id", productId)
      .eq("locale", "en-US");
    if (error) return saveError;

    revalidateTranslationPaths(productId, shop.id, shop.slug);
    return { status: "success", message: "Versión en inglés eliminada." };
  }

  const { error } = await supabase.from("product_translations").upsert(
    {
      product_id: productId,
      locale: "en-US",
      name: parsed.data.name,
      description: parsed.data.description,
      source: "manual",
      review_status: "approved",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "product_id,locale" },
  );
  if (error) return saveError;

  revalidateTranslationPaths(productId, shop.id, shop.slug);
  return { status: "success", message: "Versión en inglés guardada." };
}
