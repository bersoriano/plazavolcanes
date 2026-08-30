"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { hasListingCapacity } from "@/lib/listing-limits";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateProductImages } from "@/lib/storage";
import { productCreationSchema, productSchema, productStatusSchema } from "@/lib/validation/product";
import { uniqueProductSlug } from "@/lib/slug";

const authError: ActionState = {
  status: "error",
  message: "Tu sesión terminó. Ingresa nuevamente.",
};
const invalidCategoryError: ActionState = {
  status: "error",
  message: "Revisa los campos marcados.",
  errors: { category_id: ["Selecciona una subcategoría válida antes de publicar."] },
};
const listingLimitError: ActionState = {
  status: "error",
  message: "Alcanzaste el límite de publicaciones activas de tu tienda.",
};

function galleryImagesFrom(formData: FormData) {
  return formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

/** Uploads a gallery selection and records it, rolling back the objects on failure. */
async function storeGalleryImages(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  productId: number,
  images: File[],
  startPosition: number,
) {
  const uploaded: string[] = [];

  for (const [index, image] of images.entries()) {
    const path = `${userId}/products/${crypto.randomUUID()}.${imageExtension(image)}`;
    const { error } = await supabase.storage
      .from("catalogo")
      .upload(path, image, { contentType: image.type, upsert: false });

    if (error) {
      if (uploaded.length) await supabase.storage.from("catalogo").remove(uploaded);
      return { error: "No pudimos subir las imágenes." as const };
    }

    uploaded.push(path);
    const { error: rowError } = await supabase
      .from("product_images")
      .insert({ product_id: productId, storage_path: path, position: startPosition + index });

    if (rowError) {
      await supabase.storage.from("catalogo").remove(uploaded);
      return { error: "No pudimos guardar las imágenes." as const };
    }
  }

  return { error: null };
}

async function storedImageCount(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  productId: number,
) {
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  return count ?? 0;
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

async function shopHasListingCapacity(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  shopId: number,
  listingLimit: number,
) {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("status", "published");
  if (error) throw new Error("No pudimos consultar las publicaciones activas.");
  return hasListingCapacity(count ?? 0, listingLimit);
}

function isListingLimitDatabaseError(error: { message?: string } | null) {
  return error?.message?.includes("Límite de publicaciones alcanzado") ?? false;
}

async function nextProductSlug(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  name: string,
) {
  return uniqueProductSlug(name, async (candidate) => {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    return Boolean(data);
  });
}

export async function createProduct(
  shopId: number,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productCreationSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price_mxn: formData.get("price_mxn"),
    condition: formData.get("condition"),
    used_condition: formData.get("used_condition"),
    category_id: formData.get("category_id"),
    handling_days: formData.get("handling_days"),
    units_available: formData.get("units_available"),
    currency_code: formData.get("currency_code"),
    content_locale: formData.get("content_locale"),
  });
  const images = galleryImagesFrom(formData);

  if (!parsed.success) {
    return { status: "error", message: "Revisa los campos marcados.", errors: parsed.error.flatten().fieldErrors };
  }
  const imagesError = validateProductImages(images);
  if (imagesError) return { status: "error", message: imagesError, errors: { images: [imagesError] } };

  const context = await getAuthenticatedContext();
  if (!context) return authError;
  const { supabase, userId } = context;
  const { data: shop } = await supabase.from("shops").select("slug").eq("id", shopId).eq("owner_id", userId).maybeSingle();
  if (!shop) return { status: "error", message: "No encontramos esa tienda." };
  const slug = await nextProductSlug(supabase, parsed.data.name);
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description,
      price_mxn: parsed.data.price_mxn,
      condition: parsed.data.condition,
      used_condition: parsed.data.used_condition,
      category_id: parsed.data.category_id,
      handling_days: parsed.data.handling_days,
      units_available: parsed.data.units_available,
      currency_code: parsed.data.currency_code,
      content_locale: parsed.data.content_locale,
      shop_id: shopId,
      slug,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) {
    if (isListingLimitDatabaseError(error)) return listingLimitError;
    return { status: "error", message: "No pudimos crear el producto." };
  }

  // The cover is derived from the gallery by trigger, so images are stored after the row.
  if (images.length) {
    const stored = await storeGalleryImages(supabase, userId, data.id, images, 0);
    if (stored.error) return { status: "error", message: stored.error };
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
    units_available: formData.get("units_available"),
    currency_code: formData.get("currency_code"),
    content_locale: formData.get("content_locale"),
  });
  const images = galleryImagesFrom(formData);
  if (!parsed.success) return { status: "error", message: "Revisa los campos marcados.", errors: parsed.error.flatten().fieldErrors };

  const context = await getAuthenticatedContext();
  if (!context) return authError;
  const { supabase, userId } = context;
  const { data: existing } = await supabase.from("products").select("shop_id, image_path, status, slug, is_admin_enabled").eq("id", productId).maybeSingle();
  if (!existing || existing.status === "deleted") return { status: "error", message: "No encontramos ese producto." };
  const { data: shop } = await supabase.from("shops").select("slug, listing_limit, is_publishing_approved").eq("id", existing.shop_id).eq("owner_id", userId).maybeSingle();
  if (!shop) return { status: "error", message: "No puedes editar este producto." };
  if (parsed.data.status === "published") {
    try {
      if (!(await isPublishableCategory(supabase, parsed.data.category_id))) return invalidCategoryError;
      if (existing.status !== "published" && !(await shopHasListingCapacity(supabase, existing.shop_id, shop.listing_limit))) return listingLimitError;
    } catch {
      return { status: "error", message: "No pudimos validar esta publicación." };
    }
  }

  const alreadyStored = await storedImageCount(supabase, productId);
  const imagesError = validateProductImages(images, alreadyStored);
  if (imagesError) return { status: "error", message: imagesError, errors: { images: [imagesError] } };

  // A published slug is already out in the world, so only drafts may regenerate one.
  const slug = existing.status === "published"
    ? existing.slug
    : await nextProductSlug(supabase, parsed.data.name);
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      price_mxn: parsed.data.price_mxn,
      status: parsed.data.status,
      condition: parsed.data.condition,
      used_condition: parsed.data.used_condition,
      category_id: parsed.data.category_id,
      handling_days: parsed.data.handling_days,
      units_available: parsed.data.units_available,
      currency_code: parsed.data.currency_code,
      content_locale: parsed.data.content_locale,
      slug,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) {
    if (isListingLimitDatabaseError(error)) return listingLimitError;
    return { status: "error", message: "No pudimos guardar el producto." };
  }

  if (images.length) {
    const stored = await storeGalleryImages(supabase, userId, productId, images, alreadyStored);
    if (stored.error) return { status: "error", message: stored.error };
  }

  revalidatePath("/");
  revalidatePath(`/productos/${slug}`);
  revalidatePath(`/panel/productos/${productId}/editar`);
  revalidatePath(`/panel/tiendas/${existing.shop_id}`);
  revalidatePath(`/tiendas/${shop.slug}`);
  if (parsed.data.status === "published") {
    return {
      status: "success",
      message: shop.is_publishing_approved && existing.is_admin_enabled
        ? "Producto publicado."
        : "Producto guardado. Está pendiente de aprobación de administración.",
    };
  }
  return { status: "success", message: "Borrador guardado." };
}

export async function setProductStatus(
  productId: number,
  nextStatus: "draft" | "published",
): Promise<ActionState> {
  const parsedStatus = productStatusSchema.safeParse(nextStatus);
  const context = await getAuthenticatedContext();
  if (!parsedStatus.success || !context) redirect("/ingresar");
  const { supabase, userId } = context;
  const { data: product, error: productError } = await supabase.from("products").select("shop_id, category_id, status, slug, is_admin_enabled").eq("id", productId).maybeSingle();
  if (productError) throw new Error("No pudimos consultar el producto.");
  // Retiring a listing is one way: it stays out of the catalogue for good.
  if (!product || product.status === "deleted") redirect("/panel");
  const { data: shop, error: shopError } = await supabase.from("shops").select("slug, listing_limit, is_publishing_approved").eq("id", product.shop_id).eq("owner_id", userId).maybeSingle();
  if (shopError) throw new Error("No pudimos consultar la tienda.");
  if (!shop) redirect("/panel");
  if (parsedStatus.data === "published" && !(await isPublishableCategory(supabase, product.category_id))) {
    redirect(`/panel/productos/${productId}/editar?categoria=requerida=1`);
  }
  if (parsedStatus.data === "published" && product.status !== "published" && !(await shopHasListingCapacity(supabase, product.shop_id, shop.listing_limit))) {
    redirect(`/panel/productos/${productId}/editar?limite=alcanzado`);
  }
  const { error } = await supabase.from("products").update({ status: parsedStatus.data, updated_at: new Date().toISOString() }).eq("id", productId);
  if (isListingLimitDatabaseError(error)) redirect(`/panel/productos/${productId}/editar?limite=alcanzado`);
  if (error) throw new Error("No pudimos actualizar el estado del producto.");
  revalidatePath("/");
  revalidatePath(`/productos/${product.slug}`);
  revalidatePath(`/panel/tiendas/${product.shop_id}`);
  revalidatePath(`/tiendas/${shop.slug}`);
  if (parsedStatus.data === "draft") {
    return { status: "success", message: "Producto despublicado." };
  }
  return {
    status: "success",
    message: shop.is_publishing_approved && product.is_admin_enabled
      ? "Producto publicado."
      : "Producto guardado. Está pendiente de aprobación de administración.",
  };
}

/**
 * Removing a listing retires it instead of erasing the row.
 *
 * A conversation points at the product it is about and reads it live, so a deleted
 * row would either take the thread with it or leave it talking about nothing. The
 * record stays, hidden from the catalogue by its status; the images go, because
 * nothing shows them any more.
 */
export async function deleteProduct(productId: number) {
  const context = await getAuthenticatedContext();
  if (!context) redirect("/ingresar");
  const { supabase, userId } = context;
  const { data: product } = await supabase.from("products").select("shop_id, image_path, slug").eq("id", productId).maybeSingle();
  if (!product) redirect("/panel");
  const { data: shop } = await supabase.from("shops").select("slug").eq("id", product.shop_id).eq("owner_id", userId).maybeSingle();
  if (!shop) redirect("/panel");
  const { data: gallery } = await supabase.from("product_images").select("storage_path").eq("product_id", productId);
  // Dropping the gallery rows clears products.image_path through the cover trigger.
  await supabase.from("product_images").delete().eq("product_id", productId);
  const { error } = await supabase
    .from("products")
    .update({ status: "deleted", image_path: null, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (!error) {
    const paths = [...(gallery ?? []).map((image) => image.storage_path), product.image_path].filter(
      (path): path is string => Boolean(path),
    );
    if (paths.length) await supabase.storage.from("catalogo").remove(paths);
  }
  revalidatePath("/");
  revalidatePath(`/productos/${product.slug}`);
  revalidatePath(`/panel/tiendas/${product.shop_id}`);
  revalidatePath(`/tiendas/${shop.slug}`);
  redirect(`/panel/tiendas/${product.shop_id}`);
}

export async function removeProductImage(productId: number, imageId: number) {
  const context = await getAuthenticatedContext();
  if (!context) redirect("/ingresar");
  const { supabase, userId } = context;

  const { data: product } = await supabase
    .from("products")
    .select("shop_id, slug, shops!inner(owner_id, slug)")
    .eq("id", productId)
    .maybeSingle();
  const owner = (product as { shops?: { owner_id: string; slug: string } } | null)?.shops;
  if (!product || owner?.owner_id !== userId) redirect("/panel");

  const { data: image } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId)
    .eq("product_id", productId)
    .maybeSingle();
  if (!image) redirect(`/panel/productos/${productId}/editar`);

  const { error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .eq("product_id", productId);
  if (error) throw new Error("No pudimos eliminar la imagen.");

  await supabase.storage.from("catalogo").remove([image.storage_path]);

  revalidatePath("/");
  revalidatePath(`/productos/${product.slug}`);
  revalidatePath(`/panel/productos/${productId}/editar`);
  if (owner?.slug) revalidatePath(`/tiendas/${owner.slug}`);
}
