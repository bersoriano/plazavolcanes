import "server-only";

import type { OrderStatus } from "@/lib/database.types";
import { MEDIA_VARIANTS, mediaUrls } from "@/lib/media/url";
import {
  buildSellerDashboard,
  reportingWindow,
  type DashboardConversation,
  type DashboardOrder,
  type DashboardProduct,
  type DashboardReplyClock,
  type DashboardShop,
  type Loaded,
  type SellerDashboard,
  type WindowActivity,
} from "@/lib/seller-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SellerDashboardResult =
  | { status: "ready"; dashboard: SellerDashboard; shopImageUrls: ReadonlyMap<string, string>; now: Date }
  | { status: "error" };

const SHOP_COLUMNS =
  "id, name, slug, image_path, delivery_policy, is_publishing_approved, publishing_reviewed_at, listing_limit, is_premium, trust_tier, created_at";

const PRODUCT_COLUMNS =
  "id, shop_id, name, description, price_mxn, image_path, status, expires_at, is_admin_enabled, condition, used_condition, units_available, handling_days, category_id, updated_at";

const OPEN_ORDER_STATUSES: OrderStatus[] = ["requested", "accepted", "shipped", "delivered"];

/** How many of the seller's own messages are enough to find a first reply. */
const REPLY_SCAN_LIMIT = 200;

function loaded<T>(error: unknown, value: T): Loaded<T> {
  return error ? { ok: false } : { ok: true, value };
}

/**
 * Everything the seller dashboard shows, read for the signed-in seller only.
 *
 * Ownership is enforced twice, on purpose. Row-level security already limits
 * each table to rows the caller may see — but a seller is also a buyer, and
 * those policies happily return the orders and threads they are the *buyer*
 * on. So every read below is additionally pinned to the shop ids this user
 * owns, which is what keeps someone's shopping out of their selling panel.
 *
 * No buyer names, addresses or contact details are selected: a task needs to
 * say what and where, and the thread or order it links to shows who.
 */
export async function getSellerDashboard({
  requestedFocusShopId = null,
  now = new Date(),
}: { requestedFocusShopId?: number | null; now?: Date } = {}): Promise<SellerDashboardResult | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string" || !userId) return null;

  const [shopsResult, limitResult] = await Promise.all([
    supabase.from("shops").select(SHOP_COLUMNS).eq("owner_id", userId).order("created_at", { ascending: false }),
    supabase.rpc("current_user_shop_limit"),
  ]);
  if (shopsResult.error) return { status: "error" };

  const shops = (shopsResult.data ?? []) as DashboardShop[];
  const shopLimit = typeof limitResult.data === "number" ? limitResult.data : 1;
  const shopIds = shops.map((shop) => shop.id);
  const shopImageUrls = mediaUrls(shops.map((shop) => shop.image_path), MEDIA_VARIANTS.card);

  if (!shopIds.length) {
    const empty = { ok: true as const, value: [] };
    return {
      status: "ready",
      now,
      shopImageUrls,
      dashboard: buildSellerDashboard({
        userId,
        now,
        shopLimit,
        shops,
        products: empty,
        conversations: empty,
        openOrders: empty,
        replyClocks: empty,
        hasCompletedSale: { ok: true, value: false },
        hasAnsweredBuyer: { ok: true, value: false },
        metrics: { ok: true, value: { inquiries: [], purchaseRequests: [], completedOrders: [] } },
        requestedFocusShopId,
      }),
    };
  }

  const since = reportingWindow(now).windowStart.toISOString();

  const [
    productsResult,
    conversationsResult,
    openOrdersResult,
    completedSaleResult,
    windowRequestsResult,
    windowCompletedResult,
    windowInquiriesResult,
    sellerMessagesResult,
    replyClocksResult,
  ] = await Promise.all([
    supabase.from("products").select(PRODUCT_COLUMNS).in("shop_id", shopIds).neq("status", "deleted"),
    // The seller inbox query: it already joins through shop ownership and
    // carries the product and the newest message's sender for each thread.
    supabase.rpc("list_conversations", { p_role: "seller" }),
    supabase
      .from("orders")
      .select("id, shop_id, status, created_at, accepted_at, ship_by_at, handling_time_zone, payment_confirmation_required, payment_completed_at, fulfillment_method, order_items(product_name)")
      .in("shop_id", shopIds)
      .in("status", OPEN_ORDER_STATUSES)
      .order("created_at", { ascending: true }),
    supabase.from("orders").select("id").in("shop_id", shopIds).eq("status", "completed").limit(1),
    // Every order starts life as a purchase request, whatever became of it.
    supabase.from("orders").select("shop_id").in("shop_id", shopIds).gte("created_at", since),
    supabase.from("orders").select("shop_id").in("shop_id", shopIds).eq("status", "completed").gte("completed_at", since),
    // An enquiry counts once the buyer has actually written in it: opening a
    // thread and leaving is not a question.
    supabase
      .from("conversations")
      .select("shop_id, messages!inner(id)")
      .eq("type", "pre_sale")
      .in("shop_id", shopIds)
      .gte("created_at", since)
      .neq("messages.sender_id", userId)
      .limit(1, { referencedTable: "messages" }),
    supabase
      .from("messages")
      .select("id, conversation_id, conversations!inner(shop_id)")
      .eq("sender_id", userId)
      .in("conversations.shop_id", shopIds)
      .order("id", { ascending: true })
      .limit(REPLY_SCAN_LIMIT),
    // Open response clocks. A seller who also buys can read the clocks on the
    // threads they opened as a buyer, so these are pinned to owned shops too.
    supabase
      .from("seller_response_events")
      .select("shop_id, conversation_id, clock_started_at")
      .in("shop_id", shopIds)
      .is("replied_at", null),
  ]);

  const ownShop = new Set(shopIds);

  const replyClocks = loaded<DashboardReplyClock[]>(
    replyClocksResult.error,
    (replyClocksResult.data ?? [])
      .filter((clock) => ownShop.has(clock.shop_id))
      .map((clock) => ({ conversation_id: clock.conversation_id, clock_started_at: clock.clock_started_at })),
  );

  const openOrders = loaded(
    openOrdersResult.error,
    ((openOrdersResult.data ?? []) as unknown as (Omit<DashboardOrder, "item_names"> & { order_items: { product_name: string }[] | null })[])
      .filter((order) => ownShop.has(order.shop_id))
      .map(({ order_items, ...order }) => ({ ...order, item_names: (order_items ?? []).map((item) => item.product_name) })),
  );

  const conversations = loaded<DashboardConversation[]>(
    conversationsResult.error,
    (conversationsResult.data ?? [])
      .filter((row) => ownShop.has(row.shop_id))
      .map((row) => ({
        id: row.conversation_id,
        type: row.type,
        order_id: row.order_id,
        shop_id: row.shop_id,
        product_name: row.product_name,
        last_message:
          row.last_message_at && row.last_message_sender_id
            ? { created_at: row.last_message_at, sender_id: row.last_message_sender_id }
            : null,
      })),
  );

  const hasAnsweredBuyer = await answeredBuyer(supabase, userId, sellerMessagesResult);

  const metricsError = windowRequestsResult.error || windowCompletedResult.error || windowInquiriesResult.error;
  const metrics = loaded<WindowActivity>(metricsError, {
    inquiries: (windowInquiriesResult.data ?? []) as unknown as { shop_id: number }[],
    purchaseRequests: windowRequestsResult.data ?? [],
    completedOrders: windowCompletedResult.data ?? [],
  });

  return {
    status: "ready",
    now,
    shopImageUrls,
    dashboard: buildSellerDashboard({
      userId,
      now,
      shopLimit,
      shops,
      products: loaded(productsResult.error, (productsResult.data ?? []) as DashboardProduct[]),
      conversations,
      openOrders,
      replyClocks,
      hasCompletedSale: loaded(completedSaleResult.error, Boolean(completedSaleResult.data?.length)),
      hasAnsweredBuyer,
      metrics,
      requestedFocusShopId,
    }),
  };
}

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * Whether the seller ever wrote after a buyer did, in the same thread.
 *
 * Writing first is not answering: an order thread opens at checkout, and a
 * seller's "thanks for your order" there replies to nobody. So a seller
 * message only counts when a buyer message in that thread came before it.
 */
async function answeredBuyer(
  supabase: SupabaseClient,
  userId: string,
  sellerMessages: { data: unknown; error: unknown },
): Promise<Loaded<boolean>> {
  if (sellerMessages.error) return { ok: false };
  const rows = (sellerMessages.data ?? []) as { id: number; conversation_id: number }[];
  if (!rows.length) return { ok: true, value: false };

  const latestSellerMessage = new Map<number, number>();
  for (const row of rows) {
    latestSellerMessage.set(row.conversation_id, Math.max(row.id, latestSellerMessage.get(row.conversation_id) ?? 0));
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id")
    .in("conversation_id", [...latestSellerMessage.keys()])
    .neq("sender_id", userId)
    .order("id", { ascending: true })
    .limit(REPLY_SCAN_LIMIT);
  if (error) return { ok: false };

  return {
    ok: true,
    value: (data ?? []).some((buyerMessage) => buyerMessage.id < (latestSellerMessage.get(buyerMessage.conversation_id) ?? 0)),
  };
}
