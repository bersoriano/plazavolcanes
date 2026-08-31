/**
 * Object keys are vendor-neutral. The database stores these strings and never a
 * URL, so moving to another object store is a copy of the same keys plus a new
 * NEXT_PUBLIC_MEDIA_BASE — no row, query, or component changes.
 */
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

export function productImageKey(
  userId: string,
  productId: number,
  contentType: MediaContentType,
  id: string = crypto.randomUUID(),
) {
  return `products/${userId}/${productId}/${id}.${mediaExtension(contentType)}`;
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
