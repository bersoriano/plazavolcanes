import "server-only";

import { mapContactMessages, type ContactMessage } from "@/lib/queries/contact";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Whether someone is signed in, so the contact form knows not to ask who they
 * are. Unconfigured or unreadable reads as signed out: asking for details that
 * were not needed costs less than storing a message nobody can answer.
 */
export async function isSignedIn(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  return typeof data?.claims?.sub === "string" && data.claims.sub !== "";
}

/** What has been written to the plaza, waiting first. Administrators only. */
export async function listContactMessages(): Promise<ContactMessage[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_contact_messages");

  return error || !data ? [] : mapContactMessages(data);
}
