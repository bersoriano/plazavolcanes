import "server-only";

import { keyExtension, keyOwner, mediaExtension } from "@/lib/media/keys";
import { inspectImage } from "@/lib/media/signature";
import { deleteObjects, readObjectHeader } from "@/lib/media/store";
import { MAX_PRODUCT_IMAGES, rejectionMessage } from "@/lib/media/validation";
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
 * Records objects the browser uploaded straight to storage.
 *
 * The bytes never passed through here, so each one is checked before it is
 * recorded: the key has to belong to the caller, the object has to exist, and
 * its leading bytes have to be the format its name claims. Anything that fails
 * is deleted rather than left in a public bucket.
 */
export async function attachProductImages(
  client: MediaClient,
  userId: string,
  productId: number,
  keys: readonly string[],
) {
  if (!keys.length) return { error: null };

  const unique = [...new Set(keys)];
  if (unique.some((key) => keyOwner(key) !== userId)) {
    return { error: "No pudimos guardar las imágenes." as const };
  }

  const positions = await freePositions(client, productId);
  if (!positions) return { error: "No pudimos guardar las imágenes." as const };
  if (unique.length > positions.length) {
    return { error: `Puedes subir hasta ${MAX_PRODUCT_IMAGES} imágenes.` as const };
  }

  const headers = await Promise.all(unique.map((key) => readObjectHeader(key)));
  for (const [index, header] of headers.entries()) {
    const verdict = header ? await inspectImage(header) : null;
    const extension = keyExtension(unique[index]!);
    const honest =
      verdict?.supported === true && mediaExtension(verdict.type) === extension;

    if (!honest) {
      await deleteObjects(client, unique);
      return { error: rejectionMessage(verdict?.supported === false ? verdict.reason : "unsupported") };
    }
  }

  const rows = unique.map((key, index) => ({
    product_id: productId,
    storage_path: key,
    position: positions[index]!,
  }));
  const { error } = await client.from("product_images").insert(rows);
  if (error) {
    await deleteObjects(client, unique);
    return { error: "No pudimos guardar las imágenes." as const };
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
