import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * The signed-in buyer behind a personal route, or the sign-in page.
 *
 * The buyer's own surfaces read their rows through queries that return nothing
 * without a session, so a signed-out visitor used to be told their cart was
 * empty and their order history was empty — the same words someone sees when
 * they genuinely have neither. Asking here means an expired session reads as an
 * expired session.
 *
 * `continuar` is passed through unencoded because `safeContinuation` checks the
 * raw value starts with "/" before decoding it; a percent-encoded path fails
 * that check and drops the buyer on /panel. Pass a bare path, no query string.
 */
export const requireSignedIn = cache(async (continuar: string): Promise<string> => {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string" || !userId) redirect(`/ingresar?continuar=${continuar}`);

  return userId;
});
