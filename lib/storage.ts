import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImage(file: File) {
  if (!IMAGE_TYPES.has(file.type)) {
    return "Usa una imagen JPEG, PNG o WebP.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "La imagen debe pesar 5 MB o menos.";
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
