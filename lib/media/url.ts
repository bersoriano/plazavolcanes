import { MEDIA_BUCKET } from "@/lib/media/keys";

/**
 * The only place a media URL is built.
 *
 * Storage keys in the database are vendor-neutral; these prefixes are what make
 * them fetchable, so switching object stores is a change of environment plus a
 * copy of the objects.
 */
const SUPABASE_OBJECT_PREFIX = "/storage/v1/object/public";
const SUPABASE_RENDER_PREFIX = "/storage/v1/render/image/public";

const DEFAULT_QUALITY = 75;

/** Fit the picture inside the box. The other modes crop or distort it. */
const RESIZE_MODE = "contain";

/**
 * What each surface actually needs, at roughly twice its layout size so the
 * result still looks right on a dense screen. Nothing decodes on the device to
 * produce these: the object store renders them on the way out.
 *
 * Each one is a square box the picture has to fit inside, not a shape it is cut
 * to. A seller's photograph keeps whatever proportions it was taken at, and the
 * box only bounds its longest edge.
 */
export const MEDIA_VARIANTS = {
  thumbnail: { width: 300, height: 300 },
  card: { width: 600, height: 600 },
  hero: { width: 1200, height: 1200 },
  detail: { width: 1400, height: 1400 },
} as const;

export type MediaVariant = { width: number; height?: number; quality?: number };

function trimmed(value: string | undefined) {
  const text = value?.trim();

  return text ? text.replace(/\/+$/, "") : null;
}

/**
 * Originals and resized renditions can live at different origins, and on a
 * store with no resizing of its own only the first exists.
 */
function mediaBase(kind: "object" | "render") {
  const configured =
    kind === "object"
      ? trimmed(process.env.NEXT_PUBLIC_MEDIA_BASE)
      : trimmed(process.env.NEXT_PUBLIC_MEDIA_RESIZE_BASE);
  if (configured) return configured;

  const origin = trimmed(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!origin) return null;
  const prefix = kind === "object" ? SUPABASE_OBJECT_PREFIX : SUPABASE_RENDER_PREFIX;

  return `${origin}${prefix}/${MEDIA_BUCKET}`;
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

/**
 * A variant asks the store for a resized rendition. Where none is configured
 * the original is served instead, which is correct but heavier — never broken.
 *
 * Both dimensions and `contain` are sent every time. A renderer given one
 * dimension crops to reach it, and a renderer given two crops by default, so
 * either omission returns a picture with its edges cut off. Weight comes off
 * through scale and quality instead, which is lossy but never removes what the
 * seller photographed.
 */
export function mediaUrl(key: string, variant?: MediaVariant) {
  if (variant) {
    const base = mediaBase("render");
    if (base) {
      const query = new URLSearchParams({
        width: String(variant.width),
        height: String(variant.height ?? variant.width),
        resize: RESIZE_MODE,
        quality: String(variant.quality ?? DEFAULT_QUALITY),
      });

      return `${base}/${encodeKey(key)}?${query}`;
    }
  }

  const base = mediaBase("object");

  return base ? `${base}/${encodeKey(key)}` : null;
}

/** Keeps the shape readers already expect from a batch of keys. */
export function mediaUrls(keys: readonly (string | null | undefined)[], variant?: MediaVariant) {
  const urls = new Map<string, string>();

  for (const key of keys) {
    if (!key || urls.has(key)) continue;
    const url = mediaUrl(key, variant);
    if (url) urls.set(key, url);
  }

  return urls as ReadonlyMap<string, string>;
}
