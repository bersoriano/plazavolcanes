/**
 * Object keys are vendor-neutral. The database stores these strings and never a
 * URL, so moving to another object store is a copy of the same keys plus a new
 * NEXT_PUBLIC_MEDIA_BASE — no row, query, or component changes.
 */
/** Named here rather than in the server-only adapter, because the browser
 * uploads straight to it now. */
export const MEDIA_BUCKET = "catalogo";

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type MediaContentType = keyof typeof EXTENSIONS;

export function isMediaContentType(value: string): value is MediaContentType {
  return value in EXTENSIONS;
}

/** Extensions come from the allowlist, never from the uploaded file's name. */
export function mediaExtension(contentType: MediaContentType) {
  return EXTENSIONS[contentType];
}

/**
 * The browser uploads before the product row exists, so the key cannot carry a
 * product id. Which product an object belongs to is what the database row says;
 * the folder only has to be the owner, which is what storage authorises on.
 */
export function productImageKey(
  userId: string,
  contentType: MediaContentType,
  id: string = crypto.randomUUID(),
) {
  return `products/${userId}/${id}.${mediaExtension(contentType)}`;
}

/** The owner a key is scoped to, or null when it is not one of ours. */
export function keyOwner(key: string) {
  const [root, owner] = key.split("/");

  return (root === "products" || root === "shops") && owner ? owner : null;
}

export function keyExtension(key: string) {
  const dot = key.lastIndexOf(".");

  return dot === -1 ? null : key.slice(dot + 1).toLowerCase();
}

/**
 * A shop picture is chosen before its shop row exists, so unlike a product
 * image its key cannot carry the id of what it belongs to.
 */
export function shopImageKey(
  userId: string,
  contentType: MediaContentType,
  id: string = crypto.randomUUID(),
) {
  return `shops/${userId}/${id}.${mediaExtension(contentType)}`;
}
