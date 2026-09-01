import "server-only";

import { MEDIA_BUCKET } from "@/lib/media/keys";
import { deleteObjects } from "@/lib/media/store";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type MediaClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * The browser uploads a picture the moment it is chosen, so somebody who picks
 * photos and then abandons the form leaves objects nothing points at. They are
 * invisible, permanent, and billed.
 *
 * Long enough that a form still being filled in is never touched — someone can
 * leave a tab open overnight and come back to it.
 */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

const SWEEP_LIMIT = 100;

type Candidate = { key: string; createdAt: number };

async function listOwned(client: MediaClient, prefix: string): Promise<Candidate[]> {
  const { data, error } = await client.storage.from(MEDIA_BUCKET).list(prefix, {
    limit: SWEEP_LIMIT,
    sortBy: { column: "created_at", order: "asc" },
  });
  if (error || !data) return [];

  return data.flatMap((entry) => {
    const createdAt = entry.created_at ? Date.parse(entry.created_at) : Number.NaN;

    return entry.name && Number.isFinite(createdAt)
      ? [{ key: `${prefix}/${entry.name}`, createdAt }]
      : [];
  });
}

/**
 * Which of these keys something still points at.
 *
 * An owner's own select policies show every one of their rows whatever its
 * status, so asking with their session is enough. If any part of the question
 * fails the answer is null, and the sweep does nothing rather than guess — the
 * cost of keeping an orphan is pennies, the cost of deleting a live picture is
 * somebody's listing.
 */
async function referencedKeys(client: MediaClient, keys: string[]) {
  const [gallery, products, shops] = await Promise.all([
    client.from("product_images").select("storage_path").in("storage_path", keys),
    client.from("products").select("image_path").in("image_path", keys),
    client.from("shops").select("image_path").in("image_path", keys),
  ]);
  if (gallery.error || products.error || shops.error) return null;

  return new Set(
    [
      ...(gallery.data ?? []).map((row) => row.storage_path),
      ...(products.data ?? []).map((row) => row.image_path),
      ...(shops.data ?? []).map((row) => row.image_path),
    ].filter((key): key is string => Boolean(key)),
  );
}

/** Deletes the caller's own objects that nothing points at. Returns how many. */
export async function sweepOrphanedImages(
  client: MediaClient,
  userId: string,
  now = Date.now(),
) {
  const owned = [
    ...(await listOwned(client, `products/${userId}`)),
    ...(await listOwned(client, `shops/${userId}`)),
  ];
  const candidates = owned.filter((entry) => now - entry.createdAt > ORPHAN_GRACE_MS);
  if (!candidates.length) return 0;

  const referenced = await referencedKeys(
    client,
    candidates.map((entry) => entry.key),
  );
  if (!referenced) return 0;

  const orphans = candidates
    .map((entry) => entry.key)
    .filter((key) => !referenced.has(key));
  if (!orphans.length) return 0;

  await deleteObjects(client, orphans);

  return orphans.length;
}
