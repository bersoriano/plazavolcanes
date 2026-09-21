"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { hasListingCapacity } from "@/lib/listing-limits";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  countProductImages,
  productImageKeys,
  attachProductImages,
} from "@/lib/media/product-images";
import { deleteObjects } from "@/lib/media/store";
import { MAX_PRODUCT_IMAGES } from "@/lib/media/validation";
import { productCreationSchema, productSchema, productStatusSchema } from "@/lib/validation/product";
import { missingForPublication } from "@/lib/listing-readiness";
import { buildSiteUrl } from "@/lib/site-url";
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
const coverImageRequiredError: ActionState = {
  status: "error",
  message: "Agrega una imagen de portada antes de publicar.",
  errors: { images: ["Agrega una imagen de portada antes de publicar."] },
};

function missingPublicationError(input: Parameters<typeof missingForPublication>[0]): ActionState | null {
  const missing = missingForPublication(input);
  if (!missing.length) return null;
  const first = missing[0]!;
  const message = first.field === "images"
    ? "Agrega al menos una foto del producto antes de publicar."
    : "Completa los requisitos antes de publicar.";
  return { status: "error", message, errors: { [first.field]: [message] } };
}

/**
 * The browser uploads the pictures itself and submits only where they landed,
 * so a listing with five photos posts a few hundred bytes rather than tens of
 * megabytes.
 */
function galleryKeysFrom(formData: FormData) {
  return formData
    .getAll("image_keys")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
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
  const imageKeys = galleryKeysFrom(formData);

  if (!parsed.success) {
    return { status: "error", message: "Revisa los campos marcados.", errors: parsed.error.flatten().fieldErrors };
  }
  if (imageKeys.length > MAX_PRODUCT_IMAGES) {
    const message = `Puedes subir hasta ${MAX_PRODUCT_IMAGES} imágenes.`;
    return { status: "error", message, errors: { images: [message] } };
  }

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
  if (imageKeys.length) {
    const stored = await attachProductImages(supabase, userId, data.id, imageKeys);
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
  const imageKeys = galleryKeysFrom(formData);
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

  const alreadyStored = await countProductImages(supabase, productId);
  if (alreadyStored + imageKeys.length > MAX_PRODUCT_IMAGES) {
    const message = `Puedes subir hasta ${MAX_PRODUCT_IMAGES} imágenes.`;
    return { status: "error", message, errors: { images: [message] } };
  }
  // Only a listing on its way out the door is measured against the checklist.
  // One already published predates it and may have been filed before any of
  // these fields existed; PR #29 made the same allowance for a missing gallery
  // cover, and holding an old listing hostage to a new rule would lock its
  // seller out of editing it at all.
  if (parsed.data.status === "published" && existing.status !== "published") {
    const readiness = missingPublicationError({ ...parsed.data, imageCount: alreadyStored + imageKeys.length });
    if (readiness) return readiness;
  }

  // A newly selected image does not have a gallery row yet. Store and verify it
  // before changing the status so an upload failure cannot leave a public row
  // without its required cover.
  let attachedBeforePublication = false;
  if (parsed.data.status === "published" && existing.status !== "published" && !existing.image_path) {
    if (!imageKeys.length) return coverImageRequiredError;
    const stored = await attachProductImages(supabase, userId, productId, imageKeys);
    if (stored.error) return { status: "error", message: stored.error };
    attachedBeforePublication = true;
  }

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

  if (imageKeys.length && !attachedBeforePublication) {
    const stored = await attachProductImages(supabase, userId, productId, imageKeys);
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
        ? "Tu producto ya está publicado."
        : "Producto guardado. Está pendiente de aprobación de administración.",
      ...(shop.is_publishing_approved && existing.is_admin_enabled
        ? { values: { public_url: buildSiteUrl(`/productos/${slug}`) } }
        : {}),
    };
  }
  const nextRequirement = missingForPublication({ ...parsed.data, imageCount: alreadyStored + imageKeys.length })[0];
  return {
    status: "success",
    message: "Borrador guardado",
    ...(nextRequirement ? { values: { next_requirement: nextRequirement.label } } : {}),
  };
}

export async function setProductStatus(
  productId: number,
  nextStatus: "draft" | "published",
): Promise<ActionState> {
  const parsedStatus = productStatusSchema.safeParse(nextStatus);
  const context = await getAuthenticatedContext();
  if (!parsedStatus.success || !context) redirect("/ingresar");
  const { supabase, userId } = context;
  const { data: product, error: productError } = await supabase.from("products").select("shop_id, category_id, image_path, status, slug, is_admin_enabled, expires_at").eq("id", productId).maybeSingle();
  if (productError) throw new Error("No pudimos consultar el producto.");
  // Retiring a listing is one way: it stays out of the catalogue for good.
  if (!product || product.status === "deleted") redirect("/panel");
  const { data: shop, error: shopError } = await supabase.from("shops").select("slug, listing_limit, is_publishing_approved").eq("id", product.shop_id).eq("owner_id", userId).maybeSingle();
  if (shopError) throw new Error("No pudimos consultar la tienda.");
  if (!shop) redirect("/panel");
  if (parsedStatus.data === "published" && product.status !== "published" && !product.image_path) return coverImageRequiredError;
  if (parsedStatus.data === "published" && !(await isPublishableCategory(supabase, product.category_id))) {
    redirect(`/panel/productos/${productId}/editar?categoria=requerida=1`);
  }
  if (parsedStatus.data === "published" && product.status !== "published" && !(await shopHasListingCapacity(supabase, product.shop_id, shop.listing_limit))) {
    redirect(`/panel/productos/${productId}/editar?limite=alcanzado`);
  }
  // A listing keeps `status = 'published'` until the hourly sweep files it as
  // expired, so for up to an hour the seller is looking at a row the catalogue
  // already reports as "Vencido". Bringing that row back has to null the stale
  // date: `set_product_expiry` grants a fresh 30 days when the incoming expiry
  // is null, and would otherwise leave the lapsed one and republish something
  // that is expired on arrival. A row the sweep already reached takes the same
  // fresh window through its status change, so this only closes the gap.
  const hasLapsedWindow = product.status === "published"
    && product.expires_at !== null
    && new Date(product.expires_at).getTime() <= Date.now();
  const renewsWindow = parsedStatus.data === "published" && hasLapsedWindow;

  const { error } = await supabase.from("products").update({
    status: parsedStatus.data,
    updated_at: new Date().toISOString(),
    ...(renewsWindow ? { expires_at: null } : {}),
  }).eq("id", productId);
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
  const galleryKeys = await productImageKeys(supabase, productId);
  // Retire the listing first: published galleries are intentionally protected
  // from losing their final cover, while a retired product may release all media.
  const { error } = await supabase
    .from("products")
    .update({ status: "deleted", image_path: null, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw new Error("No pudimos eliminar el producto.");

  const { error: imageError } = await supabase.from("product_images").delete().eq("product_id", productId);
  if (imageError) throw new Error("No pudimos eliminar las imágenes.");
  await deleteObjects(supabase, [...galleryKeys, product.image_path].filter(
    (key): key is string => Boolean(key),
  ));
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

  await deleteObjects(supabase, [image.storage_path]);

  revalidatePath("/");
  revalidatePath(`/productos/${product.slug}`);
  revalidatePath(`/panel/productos/${productId}/editar`);
  if (owner?.slug) revalidatePath(`/tiendas/${owner.slug}`);
}
