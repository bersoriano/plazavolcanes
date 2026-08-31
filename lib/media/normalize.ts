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
import { probeImageSize } from "@/lib/media/dimensions";

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

/**
 * Draws the bitmap and releases it before encoding. A 12-megapixel phone photo
 * decodes to roughly 48 MB, and holding that alive across the encode is what
 * put a gallery selection over a mobile browser's memory ceiling.
 */
async function encode(bitmap: ImageBitmap) {
  const { width, height } = scaledSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return null;
  }

  try {
    context.drawImage(bitmap, 0, 0, width, height);
  } finally {
    bitmap.close();
  }

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
/**
 * Asks the decoder to downscale as it reads, so a 24-megapixel photo never
 * exists as a 97 MB bitmap. Only one edge is constrained: the other follows the
 * aspect ratio, which keeps the result undistorted however the decoder orders
 * resizing against the EXIF rotation. The canvas then applies the real cap.
 */
async function decodeOptions(file: Blob): Promise<ImageBitmapOptions> {
  const options: ImageBitmapOptions = { imageOrientation: "from-image" };
  const size = await probeImageSize(file);
  if (!size) return options;

  const longest = Math.max(size.width, size.height);
  // Never ask for more pixels than the picture has.
  if (longest <= MAX_IMAGE_EDGE) return options;

  options.resizeQuality = "high";
  if (size.width >= size.height) options.resizeWidth = MAX_IMAGE_EDGE;
  else options.resizeHeight = MAX_IMAGE_EDGE;

  return options;
}

export async function normalizeImage(file: File): Promise<File> {
  if (!canNormalize()) return file;

  let bitmap: ImageBitmap;
  try {
    // The rotation is applied here and the metadata discarded by the re-encode,
    // the GPS coordinates in it included.
    bitmap = await createImageBitmap(file, await decodeOptions(file));
  } catch {
    return file;
  }

  try {
    const blob = await encode(bitmap);
    if (!blob || blob.size >= file.size) return file;

    // A browser without WebP encoding silently produces PNG instead, so the
    // name and type follow what came back rather than what was asked for.
    const type = blob.type || NORMALIZED_TYPE;
    const extension = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";

    return new File([blob], `imagen.${extension}`, { type });
  } catch {
    return file;
  }
}

/**
 * One picture at a time, on purpose. Decoding a four-photo gallery selection at
 * once costs around 200 MB of bitmap, which is enough for a phone browser to
 * kill the tab before anything is uploaded.
 */
export async function normalizeImages(files: readonly File[]): Promise<File[]> {
  const normalized: File[] = [];
  for (const file of files) normalized.push(await normalizeImage(file));

  return normalized;
}

/**
 * What a request can carry once normalization has run or been skipped. Well
 * under the Server Action limit, because a platform may cap the body below it.
 */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

export function totalBytes(files: readonly File[]) {
  return files.reduce((sum, file) => sum + file.size, 0);
}

/** Puts the normalized files back on the input, so the plain form submit sends them. */
export function replaceInputFiles(input: HTMLInputElement, files: readonly File[]) {
  if (typeof DataTransfer !== "function") return;

  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  input.files = transfer.files;
}
