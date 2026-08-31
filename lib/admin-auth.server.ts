import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const getCurrentUserAdminStatus = cache(async () => {
  if (!isSupabaseConfigured()) return { isAdmin: false, signedIn: false };

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { isAdmin: false, signedIn: false };

  const { data: isAdmin } = await supabase.rpc("is_current_user_admin");
  return { isAdmin: Boolean(isAdmin), signedIn: true };
});

export const requireAdmin = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) redirect("/panel");

  const { isAdmin, signedIn } = await getCurrentUserAdminStatus();
  if (!signedIn) redirect("/ingresar?continuar=/admin/disputas");

  if (!isAdmin) redirect("/panel");
});
