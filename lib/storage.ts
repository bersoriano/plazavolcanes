const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_SIZE = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_PRODUCT_IMAGES = 5;
export const CATALOG_IMAGE_URL_TTL_SECONDS = 300;

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

type CatalogStorageClient = {
  storage: {
    from(bucket: string): {
      createSignedUrls(
        paths: string[],
        expiresIn: number,
      ): Promise<{
        data: { path: string | null; signedUrl: string | null; error?: unknown }[] | null;
        error: unknown;
      }>;
    };
  };
};

/** Sign every requested image in one Storage roundtrip. Failed paths stay absent. */
export async function signCatalogImagePaths(
  client: CatalogStorageClient,
  paths: readonly (string | null | undefined)[],
) {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  if (!uniquePaths.length) return urls;

  const { data, error } = await client.storage
    .from("catalogo")
    .createSignedUrls(uniquePaths, CATALOG_IMAGE_URL_TTL_SECONDS);
  if (error || !data) return urls;

  for (const item of data) {
    if (!item.error && item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }

  return urls;
}
