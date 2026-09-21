import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Whether the signed-in visitor already runs a shop.
 *
 * Pitches to open one are noise for somebody who has: the launch bar and the
 * product page's selling line both ask this, so it is `cache()`d and the two
 * of them share a single round trip per render. Counts without reading rows,
 * and pinned to the caller's own id, so row-level security has nothing to
 * leak here either way.
 */
export const viewerOwnsAnyShop = cache(async () => {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string" || !userId) return false;

  const { count } = await supabase
    .from("shops")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  return (count ?? 0) > 0;
});
