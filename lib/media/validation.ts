import { isMediaContentType } from "@/lib/media/keys";
import type { ImageVerdict } from "@/lib/media/signature";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_SIZE = 2 * 1024 * 1024;

export const MAX_PRODUCT_IMAGES = 5;

export const UNSUPPORTED_IMAGE_MESSAGE = "Usa una imagen JPEG, PNG o WebP.";

/**
 * An iPhone writes HEIC, and no browser converts it on a desktop the way iOS
 * does when the picture comes straight from the phone. Saying which way out
 * exists beats repeating the list of formats they cannot produce.
 */
export const HEIF_IMAGE_MESSAGE =
  "Las fotos HEIC del iPhone no se pueden subir desde la computadora. Súbelas desde tu iPhone, o conviértelas a JPEG.";

export function rejectionMessage(reason: Extract<ImageVerdict, { supported: false }>["reason"]) {
  return reason === "heif" ? HEIF_IMAGE_MESSAGE : UNSUPPORTED_IMAGE_MESSAGE;
}

export function validateImage(file: File) {
  if (!isMediaContentType(file.type)) {
    return UNSUPPORTED_IMAGE_MESSAGE;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "La imagen debe pesar 5 MB o menos.";
  }

  return null;
}

/**
 * Product galleries are capped tighter than the bucket: five images, 2 MB each.
 * The browser re-encodes uploads to well under that, so this is the envelope a
 * client that skipped the form has to fit in, not a limit sellers meet.
 * `alreadyStored` lets an edit count what the product already holds.
 */
export function validateProductImages(files: File[], alreadyStored = 0) {
  if (files.length + alreadyStored > MAX_PRODUCT_IMAGES) {
    return `Puedes subir hasta ${MAX_PRODUCT_IMAGES} imágenes.`;
  }

  for (const file of files) {
    if (!isMediaContentType(file.type)) return UNSUPPORTED_IMAGE_MESSAGE;
    if (file.size > MAX_PRODUCT_IMAGE_SIZE) return "Cada imagen debe pesar 2 MB o menos.";
  }

  return null;
}
