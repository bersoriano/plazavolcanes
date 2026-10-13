import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationRow } from "@/lib/queries/messages";
import { fetchThread, listConversations } from "@/lib/queries/messages.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

const orderRow: ConversationRow = {
  conversation_id: 9,
  type: "order",
  order_id: 41,
  shop_id: 3,
  shop_name: "Tienda Prueba",
  shop_slug: "tienda-prueba",
  counterpart_label: "Ana Ruiz",
  product_id: null,
  product_name: null,
  product_slug: null,
  product_image_path: null,
  product_price: null,
  product_currency_code: null,
  product_status: null,
  product_is_public: null,
  product_units_available: null,
  last_message_body: "Hola",
  last_message_at: "2026-08-23T10:00:00Z",
  last_message_sender_id: "buyer-id",
  unread_count: 1,
  order_item_name: "Reloj de cuerda",
  order_item_image_path: "tienda/reloj.jpg",
  order_item_count: 2,
};

let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE", "https://cdn.test");
  vi.stubEnv("NEXT_PUBLIC_MEDIA_RESIZE_BASE", "");
  rpc = vi.fn(async () => ({ data: [orderRow], error: null }));
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getClaims: async () => ({ data: { claims: { sub: "seller-id" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: 9, type: "order", order_id: 41, buyer_id: "buyer-id", messages: [] },
            error: null,
          }),
        }),
      }),
    }),
    rpc,
  } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("listConversations", () => {
  it("resolves the cover of an order thread's first line", async () => {
    const [summary] = await listConversations("seller");

    expect(rpc).toHaveBeenCalledWith("list_conversations", { p_role: "seller" });
    expect(summary.order_item).toEqual({
      name: "Reloj de cuerda",
      image_url: "https://cdn.test/tienda/reloj.jpg",
      more: 1,
    });
  });
});

describe("fetchThread", () => {
  it("hands the open thread what its order holds", async () => {
    const thread = await fetchThread(9);

    expect(thread?.viewer_role).toBe("seller");
    expect(thread?.order_item?.name).toBe("Reloj de cuerda");
  });
});
