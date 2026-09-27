import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ShopImportRequest = {
  id: number;
  link_count: number;
  status: string;
  created_at: string;
  handled_at: string | null;
};

export type AdminImportRequest = {
  id: number;
  shop_id: number;
  shop_name: string;
  shop_slug: string;
  links: string[];
  note: string | null;
  status: string;
  created_at: string;
  handled_at: string | null;
};

/** The shop's recent requests; empty when they cannot be read. */
export async function getShopImportRequests(shopId: number): Promise<ShopImportRequest[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("shop_import_requests", { p_shop_id: shopId });
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}

export async function getAdminImportRequests(): Promise<AdminImportRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("admin_import_requests");
  return error ? [] : (data ?? []);
}
