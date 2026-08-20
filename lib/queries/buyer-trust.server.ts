import "server-only";

import { parseBuyerTrustOutput, type BuyerTrustOutput } from "@/lib/buyer-trust";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getBuyerTrustForOrder(orderId: number): Promise<BuyerTrustOutput | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return null;

  const { data: order } = await supabase
    .from("orders")
    .select("buyer_id, shops!inner(owner_id)")
    .eq("id", orderId)
    .eq("shops.owner_id", userId)
    .maybeSingle();
  if (!order) return null;

  const buyerId = (order as unknown as { buyer_id: string }).buyer_id;
  const { data: profile } = await supabase
    .from("buyer_trust_profiles")
    .select("output")
    .eq("buyer_id", buyerId)
    .maybeSingle();
  return parseBuyerTrustOutput(profile?.output);
}
