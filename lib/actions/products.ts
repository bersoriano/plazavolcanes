"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateImage } from "@/lib/storage";
import { productSchema, productStatusSchema } from "@/lib/validation/product";

const authError: ActionState = {
  status: "error",
  message: "Tu sesión terminó. Ingresa nuevamente.",
};

function imageFrom(formData: FormData) {
  const value = formData.get("image");
  return value instanceof File && value.size > 0 ? value : null;
}

function imageExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  return "webp";
}

async function getAuthenticatedContext() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return userId ? { supabase, userId } : null;
}

export async function createProduct(
  shopId: number,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price_mxn: formData.get("price_mxn"),
    status: formData.get("status"),
  });
  const image = imageFrom(formData);

  if (!parsed.success) {
    return { status: "error", message: "Revisa los campos marcados.", errors: parsed.error.flatten().fieldErrors };
  }
  if (image) {
    const imageError = validateImage(image);
    if (imageError) return { status: "error", message: imageError, errors: { image: [imageError] } };
  }

  const context = await getAuthenticatedContext();
  if (!context) return authError;
  const { supabase, userId } = context;
  const { data: shop } = await supabase.from("shops").select("slug").eq("id", shopId).eq("owner_id", userId).maybeSingle();
  if (!shop) return { status: "error", message: "No encontramos esa tienda." };

  let imagePath: string | null = null;
  if (image) {
    imagePath = `${userId}/products/${crypto.randomUUID()}.${imageExtension(image)}`;
    const { error } = await supabase.storage.from("catalogo").upload(imagePath, image, { contentType: image.type, upsert: false });
    if (error) return { status: "error", message: "No pudimos subir la imagen." };
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ ...parsed.data, shop_id: shopId, image_path: imagePath })
    .select("id")
    .single();
  if (error || !data) {
    if (imagePath) await supabase.storage.from("catalogo").remove([imagePath]);
    return { status: "error", message: "No pudimos crear el producto." };
  }

  revalidatePath("/");
  revalidatePath(`/panel/tiendas/${shopId}`);
  revalidatePath(`/tiendas/${shop.slug}`);
  redirect(`/panel/productos/${data.id}/editar?creado=1`);
}

export async function updateProduct(
  productId: number,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price_mxn: formData.get("price_mxn"),
    status: formData.get("status"),
  });
  const image = imageFrom(formData);
  if (!parsed.success) return { status: "error", message: "Revisa los campos marcados.", errors: parsed.error.flatten().fieldErrors };
  if (image) {
    const imageError = validateImage(image);
    if (imageError) return { status: "error", message: imageError, errors: { image: [imageError] } };
  }

  const context = await getAuthenticatedContext();
  if (!context) return authError;
  const { supabase, userId } = context;
  const { data: existing } = await supabase.from("products").select("shop_id, image_path").eq("id", productId).maybeSingle();
  if (!existing) return { status: "error", message: "No encontramos ese producto." };
  const { data: shop } = await supabase.from("shops").select("slug").eq("id", existing.shop_id).eq("owner_id", userId).maybeSingle();
  if (!shop) return { status: "error", message: "No puedes editar este producto." };

  let nextImagePath = existing.image_path;
  if (image) {
    nextImagePath = `${userId}/products/${crypto.randomUUID()}.${imageExtension(image)}`;
    const { error } = await supabase.storage.from("catalogo").upload(nextImagePath, image, { contentType: image.type, upsert: false });
    if (error) return { status: "error", message: "No pudimos subir la imagen." };
  }

  const { error } = await supabase.from("products").update({ ...parsed.data, image_path: nextImagePath, updated_at: new Date().toISOString() }).eq("id", productId);
  if (error) {
    if (image && nextImagePath) await supabase.storage.from("catalogo").remove([nextImagePath]);
    return { status: "error", message: "No pudimos guardar el producto." };
  }
  if (image && existing.image_path) await supabase.storage.from("catalogo").remove([existing.image_path]);

  revalidatePath("/");
  revalidatePath(`/productos/${productId}`);
  revalidatePath(`/panel/productos/${productId}/editar`);
  revalidatePath(`/panel/tiendas/${existing.shop_id}`);
  revalidatePath(`/tiendas/${shop.slug}`);
  return { status: "success", message: parsed.data.status === "published" ? "Producto publicado." : "Borrador guardado." };
}

export async function setProductStatus(productId: number, nextStatus: "draft" | "published") {
  const parsedStatus = productStatusSchema.safeParse(nextStatus);
  const context = await getAuthenticatedContext();
  if (!parsedStatus.success || !context) redirect("/ingresar");
  const { supabase, userId } = context;
  const { data: product } = await supabase.from("products").select("shop_id").eq("id", productId).maybeSingle();
  if (!product) redirect("/panel");
  const { data: shop } = await supabase.from("shops").select("slug").eq("id", product.shop_id).eq("owner_id", userId).maybeSingle();
  if (!shop) redirect("/panel");
  await supabase.from("products").update({ status: parsedStatus.data, updated_at: new Date().toISOString() }).eq("id", productId);
  revalidatePath("/");
  revalidatePath(`/productos/${productId}`);
  revalidatePath(`/panel/tiendas/${product.shop_id}`);
  revalidatePath(`/tiendas/${shop.slug}`);
}

export async function deleteProduct(productId: number) {
  const context = await getAuthenticatedContext();
  if (!context) redirect("/ingresar");
  const { supabase, userId } = context;
  const { data: product } = await supabase.from("products").select("shop_id, image_path").eq("id", productId).maybeSingle();
  if (!product) redirect("/panel");
  const { data: shop } = await supabase.from("shops").select("slug").eq("id", product.shop_id).eq("owner_id", userId).maybeSingle();
  if (!shop) redirect("/panel");
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (!error && product.image_path) await supabase.storage.from("catalogo").remove([product.image_path]);
  revalidatePath("/");
  revalidatePath(`/panel/tiendas/${product.shop_id}`);
  revalidatePath(`/tiendas/${shop.slug}`);
  redirect(`/panel/tiendas/${product.shop_id}`);
}
