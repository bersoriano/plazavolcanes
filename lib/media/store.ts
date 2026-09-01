import "server-only";

import { MEDIA_BUCKET, type MediaContentType } from "@/lib/media/keys";
import { mediaUrl } from "@/lib/media/url";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Every write to object storage goes through here. The bucket name and the
 * Supabase Storage client are this module's private business: callers hand over
 * a vendor-neutral key and get a boolean back, so swapping the object store is
 * a rewrite of these two functions and nothing else.
 */
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

/**
 * A one-off permission to write exactly one object, handed to the browser so
 * the bytes never travel through a Server Action. Phone photos are tens of
 * megabytes; routing them through the app is what put uploads at the mercy of
 * a request body limit and of decoding them on the device first.
 */
export async function createUploadTicket(client: MediaClient, key: string) {
  const { data, error } = await client.storage.from(MEDIA_BUCKET).createSignedUploadUrl(key);

  return error || !data ? null : { key, token: data.token };
}

/**
 * The first bytes of a stored object, so an upload the server never saw can
 * still be checked against the format it claims to be.
 */
export async function readObjectHeader(key: string, bytes = 12) {
  const url = mediaUrl(key);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Range: `bytes=0-${bytes - 1}` },
    });
    if (!response.ok) return null;

    return await response.blob();
  } catch {
    return null;
  }
}
