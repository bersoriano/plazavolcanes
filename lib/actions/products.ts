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
const invalidCategoryError: ActionState = {
  status: "error",
  message: "Revisa los campos marcados.",
  errors: { category_id: ["Selecciona una subcategoría válida antes de publicar."] },
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

async function isPublishableCategory(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  categoryId: number | null,
) {
  if (categoryId === null) return false;

  const { data: leaf, error: leafError } = await supabase
    .from("categories")
    .select("parent_id")
    .eq("id", categoryId)
    .eq("listing_type", "product")
    .eq("is_active", true)
    .maybeSingle();
  if (leafError) throw new Error("No pudimos validar la subcategoría.");
  if (!leaf?.parent_id) return false;

  const { data: root, error: rootError } = await supabase
    .from("categories")
    .select("id")
    .eq("id", leaf.parent_id)
    .is("parent_id", null)
    .eq("listing_type", "product")
    .eq("is_active", true)
    .maybeSingle();
  if (rootError) throw new Error("No pudimos validar la subcategoría.");
  return Boolean(root);
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
    condition: formData.get("condition"),
    used_condition: formData.get("used_condition"),
    category_id: formData.get("category_id"),
    handling_days: formData.get("handling_days"),
    currency_code: formData.get("currency_code"),
    content_locale: formData.get("content_locale"),
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
  if (parsed.data.status === "published") {
    try {
      if (!(await isPublishableCategory(supabase, parsed.data.category_id))) return invalidCategoryError;
    } catch {
      return { status: "error", message: "No pudimos validar la subcategoría." };
    }
  }

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
    condition: formData.get("condition"),
    used_condition: formData.get("used_condition"),
    category_id: formData.get("category_id"),
    handling_days: formData.get("handling_days"),
    currency_code: formData.get("currency_code"),
    content_locale: formData.get("content_locale"),
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
  if (parsed.data.status === "published") {
    try {
      if (!(await isPublishableCategory(supabase, parsed.data.category_id))) return invalidCategoryError;
    } catch {
      return { status: "error", message: "No pudimos validar la subcategoría." };
    }
  }

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
  const { data: product, error: productError } = await supabase.from("products").select("shop_id, category_id").eq("id", productId).maybeSingle();
  if (productError) throw new Error("No pudimos consultar el producto.");
  if (!product) redirect("/panel");
  const { data: shop, error: shopError } = await supabase.from("shops").select("slug").eq("id", product.shop_id).eq("owner_id", userId).maybeSingle();
  if (shopError) throw new Error("No pudimos consultar la tienda.");
  if (!shop) redirect("/panel");
  if (parsedStatus.data === "published" && !(await isPublishableCategory(supabase, product.category_id))) {
    redirect(`/panel/productos/${productId}/editar?categoria=requerida=1`);
  }
  const { error } = await supabase.from("products").update({ status: parsedStatus.data, updated_at: new Date().toISOString() }).eq("id", productId);
  if (error) throw new Error("No pudimos actualizar el estado del producto.");
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
