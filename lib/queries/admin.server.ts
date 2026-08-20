import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminDispute = {
  id: number;
  order_id: number;
  reason: string;
  status: "open" | "seller_responded" | "resolved";
  buyer_statement: string;
  seller_response: string | null;
  opened_at: string;
  shop: { id: number; name: string; slug: string };
};

export async function getAdminDisputes(): Promise<AdminDispute[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabaseClient();
  const { data: allowed } = await supabase.rpc("is_current_user_admin");
  if (!allowed) return [];
  const { data } = await supabase.from("order_disputes").select("id, order_id, reason, status, buyer_statement, seller_response, opened_at, shops!inner(id, name, slug)").neq("status", "resolved").order("opened_at");
  return ((data ?? []) as unknown as (Omit<AdminDispute, "shop"> & { shops: AdminDispute["shop"] })[]).map((row) => ({ ...row, shop: row.shops }));
}
