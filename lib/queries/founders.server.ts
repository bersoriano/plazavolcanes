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
    if (!claims?.claims?.sub) return false;
    const { data, error } = await supabase.rpc("current_user_is_founder");
    return !error && data === true;
  } catch {
    return false;
  }
});
