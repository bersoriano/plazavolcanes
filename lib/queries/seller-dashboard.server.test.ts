import { afterEach, describe, expect, it, vi } from "vitest";

import { getSellerDashboard } from "@/lib/queries/seller-dashboard.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

type Call = { table: string; method: string; args: unknown[] };

/**
 * A stand-in for the query builder: every chained call is recorded and the
 * query resolves to whatever the test says that table returns.
 */
function fakeSupabase({
  userId = "seller-1",
  tables = {},
  rpc = {},
}: {
  userId?: string | null;
  tables?: Record<string, { data: unknown; error?: unknown } | { data: unknown; error?: unknown }[]>;
  rpc?: Record<string, { data: unknown; error?: unknown }>;
}) {
  const calls: Call[] = [];
  const served = new Map<string, number>();

  function builder(table: string) {
    const results = tables[table];
    const index = served.get(table) ?? 0;
    served.set(table, index + 1);
    const result = Array.isArray(results) ? (results[index] ?? { data: [] }) : (results ?? { data: [] });
    const target = {
      then: (resolve: (value: unknown) => unknown) => resolve({ error: null, ...result }),
    };
    const proxy: object = new Proxy(target, {
      get(object, method: string) {
        if (method === "then") return object.then;
        return (...args: unknown[]) => {
          calls.push({ table, method, args });
          return proxy;
        };
      },
    });
    return proxy;
  }

  const client = {
    auth: { getClaims: vi.fn().mockResolvedValue({ data: userId ? { claims: { sub: userId } } : null }) },
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(async (name: string) => ({ error: null, ...(rpc[name] ?? { data: null }) })),
  };
  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never);
  return { client, calls };
}

const ownedShop = {
  id: 7,
  name: "Casa Niebla",
  slug: "casa-niebla",
  image_path: null,
  delivery_policy: null,
  is_publishing_approved: true,
  publishing_reviewed_at: "2026-09-01T00:00:00.000Z",
  listing_limit: 15,
  is_premium: false,
  trust_tier: "standard",
  created_at: "2026-09-01T00:00:00.000Z",
};

describe("getSellerDashboard", () => {
  it("reads nothing without a signed-in seller", async () => {
    const { client } = fakeSupabase({ userId: null });

    await expect(getSellerDashboard()).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("scopes every read to the shops this user owns", async () => {
    // RLS lets a seller read orders and threads they are the buyer on, so the
    // shop filter is what keeps their own shopping out of their selling panel.
    const { calls } = fakeSupabase({
      tables: { shops: { data: [ownedShop] } },
      rpc: { current_user_shop_limit: { data: 1 } },
    });

    await getSellerDashboard();

    expect(calls).toContainEqual({ table: "shops", method: "eq", args: ["owner_id", "seller-1"] });
    for (const table of ["products", "orders", "conversations", "seller_response_events"]) {
      const scoped = calls.filter((call) => call.table === table && call.method === "in" && call.args[0] === "shop_id");
      expect(scoped.length, table).toBeGreaterThan(0);
      for (const call of scoped) expect(call.args[1]).toEqual([7]);
    }
    expect(calls).toContainEqual({ table: "messages", method: "in", args: ["conversations.shop_id", [7]] });
    // Only clocks still waiting on a reply matter to the queue.
    expect(calls).toContainEqual({ table: "seller_response_events", method: "is", args: ["replied_at", null] });
  });

  it("reads when each open order was accepted and in which time zone its promise was made", async () => {
    const { calls } = fakeSupabase({ tables: { shops: { data: [ownedShop] } }, rpc: { current_user_shop_limit: { data: 1 } } });

    await getSellerDashboard();

    const openOrders = calls.find((call) => call.table === "orders" && call.method === "select" && String(call.args[0]).includes("ship_by_at"));
    expect(String(openOrders?.args[0])).toMatch(/accepted_at.*handling_time_zone|handling_time_zone.*accepted_at/);
  });

  it("keeps reply deadlines unknown, not absent, when response clocks cannot be read", async () => {
    fakeSupabase({
      tables: { shops: { data: [ownedShop] }, seller_response_events: { data: null, error: { message: "down" } } },
      rpc: { current_user_shop_limit: { data: 1 } },
    });

    const result = await getSellerDashboard();

    expect(result).toMatchObject({ status: "ready", dashboard: { unavailable: { attention: false, deadlines: true } } });
  });

  it("never selects buyer contact details or addresses", async () => {
    const { calls } = fakeSupabase({ tables: { shops: { data: [ownedShop] } }, rpc: { current_user_shop_limit: { data: 1 } } });

    await getSellerDashboard();

    const selected = calls.filter((call) => call.method === "select").map((call) => String(call.args[0]));
    for (const columns of selected) {
      expect(columns).not.toMatch(/buyer_id|address|alt_contact|phone|email|recipient|body/);
    }
  });

  it("skips shop-level reads for somebody without a shop", async () => {
    const { client } = fakeSupabase({ tables: { shops: { data: [] } }, rpc: { current_user_shop_limit: { data: 1 } } });

    const result = await getSellerDashboard();

    expect(result).toMatchObject({ status: "ready", dashboard: { primary: { kind: "create_shop" } } });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("reports an error when the shops themselves cannot be read", async () => {
    fakeSupabase({ tables: { shops: { data: null, error: { message: "boom" } } } });

    await expect(getSellerDashboard()).resolves.toEqual({ status: "error" });
  });

  it("keeps a failed section unknown rather than empty", async () => {
    fakeSupabase({
      tables: {
        shops: { data: [ownedShop] },
        // open orders, completed, window requests, window completed
        orders: [{ data: null, error: { message: "down" } }, { data: [] }, { data: [] }, { data: [] }],
      },
      rpc: { current_user_shop_limit: { data: 1 } },
    });

    const result = await getSellerDashboard();

    expect(result).toMatchObject({ status: "ready", dashboard: { unavailable: { attention: true } } });
  });

  it("does not count a seller's first message in a thread as answering a buyer", async () => {
    fakeSupabase({
      tables: {
        shops: { data: [ownedShop] },
        // The seller's own messages, then the buyers' messages in those threads.
        messages: [{ data: [{ id: 10, conversation_id: 3 }] }, { data: [{ id: 11, conversation_id: 3 }] }],
      },
      rpc: { current_user_shop_limit: { data: 1 } },
    });

    const result = await getSellerDashboard();
    if (result?.status !== "ready") throw new Error("expected a dashboard");

    expect(result.dashboard.checklist.steps.find((step) => step.id === "first_reply")?.state).toBe("todo");
  });

  it("counts a seller reply that follows a buyer message", async () => {
    fakeSupabase({
      tables: {
        shops: { data: [ownedShop] },
        messages: [{ data: [{ id: 12, conversation_id: 3 }] }, { data: [{ id: 11, conversation_id: 3 }] }],
      },
      rpc: { current_user_shop_limit: { data: 1 } },
    });

    const result = await getSellerDashboard();
    if (result?.status !== "ready") throw new Error("expected a dashboard");

    expect(result.dashboard.checklist.steps.find((step) => step.id === "first_reply")?.state).toBe("done");
  });
});
