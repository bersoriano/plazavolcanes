import "server-only";

import type { Json } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TrustDashboard } from "@/lib/trust-tiers";

function stringArray(value: Json): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function getShopTrustDashboard(shopId: number): Promise<TrustDashboard | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") return null;

  const { data: shop } = await supabase
    .from("shops")
    .select("id, trust_tier, listing_limit, trust_evaluated_at")
    .eq("id", shopId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!shop) return null;

  const [evaluationResult, publishedResult] = await Promise.all([
    supabase
      .from("shop_trust_evaluations")
      .select("*")
      .eq("shop_id", shopId)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "published"),
  ]);
  const evaluation = evaluationResult.data;

  return {
    tier: shop.trust_tier,
    listingLimit: shop.listing_limit,
    publishedCount: publishedResult.count ?? 0,
    evaluatedAt: evaluation?.evaluated_at ?? shop.trust_evaluated_at,
    metrics: evaluation
      ? {
          averageReplyTimeMinutes: evaluation.average_reply_time_minutes,
          responseRate: evaluation.response_rate,
          descriptionAccuracy: evaluation.description_accuracy,
          onTimeShippingRate: evaluation.on_time_shipping_rate,
          orderCompletionRate: evaluation.order_completion_rate,
          disputeRate: evaluation.dispute_rate,
          totalOrders: evaluation.total_orders,
          averageRating: evaluation.average_rating,
          reviewCount: evaluation.review_count,
          lastActiveDaysAgo: evaluation.last_active_days_ago,
          openDisputeCount: evaluation.open_dispute_count,
        }
      : null,
    reasons: evaluation ? stringArray(evaluation.reasons) : [],
    nextRequirements: evaluation ? stringArray(evaluation.next_tier_requirements) : [],
    summary: evaluation?.summary ?? "Estamos reuniendo evidencia para la primera evaluación de confianza.",
  };
}
