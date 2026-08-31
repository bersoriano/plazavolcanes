/**
 * Sellers upload whatever their phone produced — commonly several megabytes of
 * 4000px JPEG. Re-encoding in the browser before the upload leaves every object
 * in the same size band, which is what makes storage cost, catalogue bandwidth,
 * and the Server Action body limit predictable rather than a property of the
 * seller's camera.
 *
 * This is a convenience, not a control: anything can be posted to the action
 * directly. The server's own rules stay load-bearing.
 */
export const MAX_IMAGE_EDGE = 1600;
export const IMAGE_QUALITY = 0.8;
export const NORMALIZED_TYPE = "image/webp";

/** The size a picture becomes once its long edge is capped. */
export function scaledSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE) {
  const longest = Math.max(width, height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canNormalize() {
  return (
    typeof createImageBitmap === "function" && typeof document?.createElement === "function"
  );
}

async function encode(bitmap: ImageBitmap) {
  const { width, height } = scaledSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, NORMALIZED_TYPE, IMAGE_QUALITY);
  });
}

/**
 * Returns the re-encoded picture, or the original when re-encoding is
 * unavailable, fails, or would make the file bigger — a small PNG can encode
 * larger as WebP, and uploading the bigger of the two helps nobody. Whatever
 * comes back, the server validates it as it would any upload.
 */
export async function normalizeImage(file: File): Promise<File> {
  if (!canNormalize()) return file;

  let bitmap: ImageBitmap;
  try {
    // Applies the EXIF rotation, which the re-encode then discards along with
    // the rest of the metadata — the GPS coordinates in it included.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const blob = await encode(bitmap);
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], "imagen.webp", { type: NORMALIZED_TYPE });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

export function normalizeImages(files: readonly File[]): Promise<File[]> {
  return Promise.all(files.map((file) => normalizeImage(file)));
}

/** Puts the normalized files back on the input, so the plain form submit sends them. */
export function replaceInputFiles(input: HTMLInputElement, files: readonly File[]) {
  if (typeof DataTransfer !== "function") return;

  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  input.files = transfer.files;
}
