import "server-only";

import { cache } from "react";

import { MEDIA_VARIANTS, mediaUrls } from "@/lib/media/url";
import { shopApproval, type DashboardShop, type ShopCard } from "@/lib/seller-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * The shop behind a panel URL, or nothing.
 *
 * The catalogue and the settings are two routes over one shop, and this is the
 * single place either of them proves the signed-in user owns it. Wrapped in
 * React's `cache` so the two reads inside one render are one round trip.
 */
export const getOwnedShop = cache(async (shopId: number) => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  // No subject means no owner to match. Falling back to an empty string would
  // send a filter to the database that a row could conceivably satisfy.
  if (typeof userId !== "string" || !userId) return null;

  const { data } = await supabase
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .eq("owner_id", userId)
    .maybeSingle();

  return data ?? null;
});

const SHOP_CARD_COLUMNS =
  "id, name, slug, image_path, is_publishing_approved, publishing_reviewed_at, listing_limit, is_premium, trust_tier";

type ShopCardRow = ShopCard["shop"] & Pick<DashboardShop, "is_publishing_approved" | "publishing_reviewed_at">;

export type SellerShopsResult =
  | {
      status: "ready";
      shops: ShopCard[];
      shopLimit: number;
      canCreateShop: boolean;
      /** False when the listings could not be counted; the shops are still listed. */
      listingsLoaded: boolean;
      imageUrls: ReadonlyMap<string, string>;
    }
  | { status: "error" };

/**
 * The signed-in seller's shops, as the cards that list them, newest first.
 *
 * The dashboard reads the same shops along with every order, thread and
 * listing it needs to decide what comes next. The list of shops needs none of
 * that: the shops, how many more may be created, and how much of each quota is
 * used.
 */
export async function getSellerShops(): Promise<SellerShopsResult | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string" || !userId) return null;

  const [shopsResult, limitResult] = await Promise.all([
    supabase.from("shops").select(SHOP_CARD_COLUMNS).eq("owner_id", userId).order("created_at", { ascending: false }),
    supabase.rpc("current_user_shop_limit"),
  ]);
  if (shopsResult.error) return { status: "error" };

  const rows = (shopsResult.data ?? []) as ShopCardRow[];
  const shopLimit = typeof limitResult.data === "number" ? limitResult.data : 1;
  const shopIds = rows.map((shop) => shop.id);

  // Published through the status column is what the quota counts (see
  // summarizeShop). A seller also shops, and may read every public listing on
  // the plaza, so the count is pinned to the shops they own.
  const published = new Map<number, number>();
  let listingsLoaded = true;
  if (shopIds.length) {
    const { data, error } = await supabase.from("products").select("shop_id").in("shop_id", shopIds).eq("status", "published");
    listingsLoaded = !error;
    for (const product of data ?? []) {
      published.set(product.shop_id, (published.get(product.shop_id) ?? 0) + 1);
    }
  }

  return {
    status: "ready",
    shops: rows.map((shop) => ({
      shop,
      publishedQuotaCount: published.get(shop.id) ?? 0,
      approval: shopApproval(shop),
    })),
    shopLimit,
    canCreateShop: rows.length < shopLimit,
    listingsLoaded,
    imageUrls: mediaUrls(rows.map((shop) => shop.image_path), MEDIA_VARIANTS.card),
  };
}
