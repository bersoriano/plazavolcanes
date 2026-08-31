import "server-only";

import { productImageKey } from "@/lib/media/keys";
import { sniffImageType } from "@/lib/media/signature";
import { deleteObjects, putObject } from "@/lib/media/store";
import { MAX_PRODUCT_IMAGES } from "@/lib/media/validation";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type MediaClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * Positions are a product's five gallery slots, and the lowest one in use is
 * the cover. Removing an image leaves its slot empty, so a later upload takes
 * the free slots rather than counting rows — counting collides with the
 * `unique (product_id, position)` constraint as soon as a gap exists.
 */
async function freePositions(client: MediaClient, productId: number) {
  const { data, error } = await client
    .from("product_images")
    .select("position")
    .eq("product_id", productId);
  if (error) return null;

  const taken = new Set((data ?? []).map((image) => image.position));
  return Array.from({ length: MAX_PRODUCT_IMAGES }, (_, position) => position).filter(
    (position) => !taken.has(position),
  );
}

export async function countProductImages(client: MediaClient, productId: number) {
  const { count } = await client
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  return count ?? 0;
}

/**
 * Uploads a gallery selection and records it. A failure part-way through undoes
 * the whole batch — both the objects and the rows already written — so a
 * half-stored gallery never outlives the request that made it.
 */
export async function storeProductImages(
  client: MediaClient,
  userId: string,
  productId: number,
  images: File[],
) {
  if (!images.length) return { error: null };

  const positions = await freePositions(client, productId);
  if (!positions) return { error: "No pudimos guardar las imágenes." as const };
  if (images.length > positions.length) {
    return { error: `Puedes subir hasta ${MAX_PRODUCT_IMAGES} imágenes.` as const };
  }

  // Every file is sniffed before anything is written, so a batch carrying one
  // file that is not really an image fails without leaving objects behind.
  const contentTypes = await Promise.all(images.map((image) => sniffImageType(image)));
  if (contentTypes.some((contentType) => contentType === null)) {
    return { error: "Usa una imagen JPEG, PNG o WebP." as const };
  }

  const keys: string[] = [];
  const rowIds: number[] = [];

  async function rollback() {
    if (rowIds.length) await client.from("product_images").delete().in("id", rowIds);
    await deleteObjects(client, keys);
  }

  for (const [index, image] of images.entries()) {
    const contentType = contentTypes[index]!;
    const key = productImageKey(userId, productId, contentType);
    if (!(await putObject(client, key, image, contentType))) {
      await rollback();
      return { error: "No pudimos subir las imágenes." as const };
    }
    keys.push(key);

    const { data, error } = await client
      .from("product_images")
      .insert({ product_id: productId, storage_path: key, position: positions[index] })
      .select("id")
      .single();
    if (error || !data) {
      await rollback();
      return { error: "No pudimos guardar las imágenes." as const };
    }
    rowIds.push(data.id);
  }

  return { error: null };
}

/** Every key a product owns, cover included, for deleting it. */
export async function productImageKeys(client: MediaClient, productId: number) {
  const { data } = await client
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);

  return (data ?? []).map((image) => image.storage_path);
}

/** Every key a shop owns: its own picture plus every gallery under it. */
export async function shopImageKeys(
  client: MediaClient,
  shopId: number,
  shopImagePath: string | null,
) {
  const { data: products } = await client
    .from("products")
    .select("id, image_path")
    .eq("shop_id", shopId);
  const productIds = (products ?? []).map((product) => product.id);
  const { data: gallery } = productIds.length
    ? await client.from("product_images").select("storage_path").in("product_id", productIds)
    : { data: [] };

  return [
    shopImagePath,
    ...(products ?? []).map((product) => product.image_path),
    ...(gallery ?? []).map((image) => image.storage_path),
  ].filter((key): key is string => Boolean(key));
}
