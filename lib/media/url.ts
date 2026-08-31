/**
 * The only place a media URL is built. Everything else passes storage keys
 * around, so repointing this prefix is what a change of object store costs.
 */
const SUPABASE_PUBLIC_PREFIX = "/storage/v1/object/public/catalogo";

function mediaBase() {
  const configured = process.env.NEXT_PUBLIC_MEDIA_BASE?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  // Until NEXT_PUBLIC_MEDIA_BASE is deployed, fall back to the bucket's own
  // public origin. This function is the one place allowed to know that shape.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return supabaseUrl
    ? `${supabaseUrl.replace(/\/+$/, "")}${SUPABASE_PUBLIC_PREFIX}`
    : null;
}

export function mediaUrl(key: string) {
  const base = mediaBase();
  if (!base) return null;

  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Keeps the shape readers already expect from a batch of keys. */
export function mediaUrls(keys: readonly (string | null | undefined)[]) {
  const urls = new Map<string, string>();

  for (const key of keys) {
    if (!key || urls.has(key)) continue;
    const url = mediaUrl(key);
    if (url) urls.set(key, url);
  }

  return urls as ReadonlyMap<string, string>;
}
