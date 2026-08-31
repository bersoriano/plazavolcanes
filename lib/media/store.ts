import "server-only";

import type { MediaContentType } from "@/lib/media/keys";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Every write to object storage goes through here. The bucket name and the
 * Supabase Storage client are this module's private business: callers hand over
 * a vendor-neutral key and get a boolean back, so swapping the object store is
 * a rewrite of these two functions and nothing else.
 */
const MEDIA_BUCKET = "catalogo";

type MediaClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function putObject(
  client: MediaClient,
  key: string,
  body: File,
  contentType: MediaContentType,
) {
  const { error } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(key, body, { contentType, upsert: false });

  return !error;
}

/** Best effort: a key that will not delete must not fail the caller's write. */
export async function deleteObjects(client: MediaClient, keys: readonly string[]) {
  const present = [...new Set(keys.filter((key): key is string => Boolean(key)))];
  if (!present.length) return;

  await client.storage.from(MEDIA_BUCKET).remove(present);
}
