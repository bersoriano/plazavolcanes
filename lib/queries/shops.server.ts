import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * The shop behind a panel URL, or nothing.
 *
 * The catalogue and the settings are two routes over one shop, and this is the
 * single place either of them proves the signed-in user owns it. Wrapped in
 * React's `cache` so the two reads inside one render are one round trip.
 */
export const getOwnedShop = cache(async (shopId: number) => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  // No subject means no owner to match. Falling back to an empty string would
  // send a filter to the database that a row could conceivably satisfy.
  if (typeof userId !== "string" || !userId) return null;

  const { data } = await supabase
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .eq("owner_id", userId)
    .maybeSingle();

  return data ?? null;
});
