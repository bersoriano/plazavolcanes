import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_SIZE = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_PRODUCT_IMAGES = 5;

export function validateImage(file: File) {
  if (!IMAGE_TYPES.has(file.type)) {
    return "Usa una imagen JPEG, PNG o WebP.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "La imagen debe pesar 5 MB o menos.";
  }

  return null;
}

/**
 * Product galleries are capped tighter than the bucket: five images, 2 MB each.
 * `alreadyStored` lets an edit count what the product already holds.
 */
export function validateProductImages(files: File[], alreadyStored = 0) {
  if (files.length + alreadyStored > MAX_PRODUCT_IMAGES) {
    return `Puedes subir hasta ${MAX_PRODUCT_IMAGES} imágenes.`;
  }

  for (const file of files) {
    if (!IMAGE_TYPES.has(file.type)) return "Usa una imagen JPEG, PNG o WebP.";
    if (file.size > MAX_PRODUCT_IMAGE_SIZE) return "Cada imagen debe pesar 2 MB o menos.";
  }

  return null;
}

export function getCatalogImageUrl(path: string | null) {
  if (!path || !isSupabaseConfigured()) {
    return null;
  }

  const { url } = getSupabaseConfig();
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  return `${url}/storage/v1/object/public/catalogo/${encodedPath}`;
}
