import { isMediaContentType } from "@/lib/media/keys";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_SIZE = 1024 * 1024;

export const MAX_PRODUCT_IMAGES = 5;

export function validateImage(file: File) {
  if (!isMediaContentType(file.type)) {
    return "Usa una imagen JPEG, PNG o WebP.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "La imagen debe pesar 5 MB o menos.";
  }

  return null;
}

/**
 * Product galleries are capped tighter than the bucket: five images, 1 MB each.
 * The browser re-encodes uploads to well under that, so this is the envelope a
 * client that skipped the form has to fit in, not a limit sellers meet.
 * `alreadyStored` lets an edit count what the product already holds.
 */
export function validateProductImages(files: File[], alreadyStored = 0) {
  if (files.length + alreadyStored > MAX_PRODUCT_IMAGES) {
    return `Puedes subir hasta ${MAX_PRODUCT_IMAGES} imágenes.`;
  }

  for (const file of files) {
    if (!isMediaContentType(file.type)) return "Usa una imagen JPEG, PNG o WebP.";
    if (file.size > MAX_PRODUCT_IMAGE_SIZE) return "Cada imagen debe pesar 1 MB o menos.";
  }

  return null;
}
