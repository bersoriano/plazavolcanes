import "server-only";

import { cache } from "react";

import { FOUNDERS_FALLBACK, toFoundersProgram, type FoundersProgram } from "@/lib/launch";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * The founders promotion, read once per request and shared by the launch bar,
 * the home page and /vender. Anything short of a real status (no Supabase, the
 * migration not yet applied, a failed call) keeps the offer up without a
 * number, which is what the site showed before the counter existed.
 */
export const getFoundersProgram = cache(async (): Promise<FoundersProgram> => {
  if (!isSupabaseConfigured()) return FOUNDERS_FALLBACK;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("founders_status");
    if (error) return FOUNDERS_FALLBACK;
    return toFoundersProgram(Array.isArray(data) ? data[0] : null);
  } catch {
    return FOUNDERS_FALLBACK;
  }
});

/** Whether the signed-in visitor runs a founding store (false when signed out). */
export const viewerIsFounder = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  try {
    const supabase = await createServerSupabaseClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (typeof userId !== "string" || !userId) return false;
    const { count } = await supabase
      .from("shops")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .not("founder_since", "is", null);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
});
