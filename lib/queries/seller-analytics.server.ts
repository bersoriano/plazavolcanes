import "server-only";

import { sellerAnalyticsSchema, type AnalyticsFilters, type SellerAnalytics } from "@/lib/seller-analytics";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SellerAnalyticsResult = { status: "ready"; report: SellerAnalytics } | { status: "error" } | { status: "invalid_shop" };

export async function getSellerAnalytics(filters: AnalyticsFilters): Promise<SellerAnalyticsResult> {
  if (filters.invalidShop) return { status: "invalid_shop" };
  if (!isSupabaseConfigured()) return { status: "error" };
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("seller_product_analytics", { p_days: filters.days, p_shop_id: filters.shopId });
    if (error) return { status: error.code === "42501" ? "invalid_shop" : "error" };
    const parsed = sellerAnalyticsSchema.safeParse(data);
    return parsed.success ? { status: "ready", report: parsed.data } : { status: "error" };
  } catch { return { status: "error" }; }
}
