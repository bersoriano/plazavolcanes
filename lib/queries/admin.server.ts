import "server-only";

import {
  mapAdminMarketplaceUsers,
  type AdminMarketplaceUser,
} from "@/lib/queries/admin";
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
  conversation_id: number | null;
};

export async function getAdminDisputes(): Promise<AdminDispute[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabaseClient();
  const { data: allowed } = await supabase.rpc("is_current_user_admin");
  if (!allowed) return [];
  const { data } = await supabase.from("order_disputes").select("id, order_id, reason, status, buyer_statement, seller_response, opened_at, shops!inner(id, name, slug)").neq("status", "resolved").order("opened_at");
  const rows = (data ?? []) as unknown as (Omit<AdminDispute, "shop" | "conversation_id"> & { shops: AdminDispute["shop"] })[];

  // Administrators no longer read conversations directly, so the order is
  // resolved to its thread through the function that authorizes them.
  return Promise.all(
    rows.map(async (row) => {
      const { data: conversationId } = await supabase.rpc("admin_conversation_for_order", {
        p_order_id: row.order_id,
      });

      return { ...row, shop: row.shops, conversation_id: conversationId ?? null };
    }),
  );
}

export async function getAdminMarketplaceUsers(): Promise<AdminMarketplaceUser[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_admin_marketplace_users");

  if (error) {
    throw new Error("No pudimos consultar los usuarios de la plataforma.");
  }

  return mapAdminMarketplaceUsers(data ?? []);
}
