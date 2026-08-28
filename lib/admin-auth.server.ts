import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const requireAdmin = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) redirect("/panel");

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/ingresar?continuar=/admin/disputas");

  const { data: allowed } = await supabase.rpc("is_current_user_admin");
  if (!allowed) redirect("/panel");
});
