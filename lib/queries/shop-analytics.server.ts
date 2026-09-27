import "server-only";

import { ANALYTICS_DAYS, summarizeShopAnalytics, type ShopAnalytics } from "@/lib/shop-analytics";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** The owner's last 30 days, or null when the stats cannot be read. */
export async function getShopAnalytics(shopId: number): Promise<ShopAnalytics | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("shop_product_stats", { p_shop_id: shopId, p_days: ANALYTICS_DAYS });
    if (error || !data) return null;
    return summarizeShopAnalytics(data);
  } catch {
    return null;
  }
}
