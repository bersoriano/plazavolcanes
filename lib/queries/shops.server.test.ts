import { afterEach, describe, expect, it, vi } from "vitest";

import { getOwnedShop, getSellerShops } from "@/lib/queries/shops.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

function supabaseReturning(result: unknown, claims: unknown = { claims: { sub: "seller-1" } }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  const client = {
    auth: { getClaims: vi.fn().mockResolvedValue({ data: claims }) },
    from: vi.fn().mockReturnValue(query),
  };
  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never);
  return { client, query };
}

describe("getOwnedShop", () => {
  it("scopes the read to the signed-in owner", async () => {
    // Both routes in the workspace read the shop through here, so the owner
    // filter has to live in this one place. A shop id in the URL must never be
    // enough to open somebody else's panel.
    const { query } = supabaseReturning({ data: { id: 4, name: "Casa Niebla" }, error: null });

    await getOwnedShop(4);

    expect(query.eq).toHaveBeenCalledWith("id", 4);
    expect(query.eq).toHaveBeenCalledWith("owner_id", "seller-1");
  });

  it("returns the shop it found", async () => {
    supabaseReturning({ data: { id: 4, name: "Casa Niebla" }, error: null });

    await expect(getOwnedShop(4)).resolves.toMatchObject({ name: "Casa Niebla" });
  });

  it("returns nothing for a shop the signed-in user does not own", async () => {
    supabaseReturning({ data: null, error: null });

    await expect(getOwnedShop(4)).resolves.toBeNull();
  });

  it("returns nothing when nobody is signed in", async () => {
    // Without a subject there is no owner to compare against; querying with an
    // empty string would be a filter that some row could conceivably match.
    const { client } = supabaseReturning({ data: null, error: null }, null);

    await expect(getOwnedShop(4)).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });
});

type Call = { table: string; method: string; args: unknown[] };

/**
 * A stand-in for the query builder: every chained call is recorded and the
 * query resolves to whatever the test says that table returns.
 */
function fakeSupabase({
  userId = "seller-1",
  tables = {},
  shopLimit = 1,
}: {
  userId?: string | null;
  tables?: Record<string, { data: unknown; error?: unknown }>;
  shopLimit?: number | null;
} = {}) {
  const calls: Call[] = [];

  function builder(table: string) {
    const target = {
      then: (resolve: (value: unknown) => unknown) => resolve({ error: null, ...(tables[table] ?? { data: [] }) }),
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
    rpc: vi.fn(async () => ({ data: shopLimit, error: null })),
  };
  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never);
  return { client, calls };
}

function shopRow(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Tienda ${id}`,
    slug: `tienda-${id}`,
    image_path: null,
    is_publishing_approved: true,
    publishing_reviewed_at: "2026-09-01T00:00:00.000Z",
    listing_limit: 25,
    is_premium: false,
    trust_tier: "standard",
    ...overrides,
  };
}

describe("getSellerShops", () => {
  it("reads nothing when nobody is signed in", async () => {
    const { client } = fakeSupabase({ userId: null });

    await expect(getSellerShops()).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("lists only the shops the signed-in seller owns", async () => {
    const { calls } = fakeSupabase({ tables: { shops: { data: [shopRow(7), shopRow(9)] } }, shopLimit: 2 });

    const result = await getSellerShops();

    expect(calls).toContainEqual({ table: "shops", method: "eq", args: ["owner_id", "seller-1"] });
    expect(result).toMatchObject({ status: "ready" });
    expect(result?.status === "ready" ? result.shops.map((entry) => entry.shop.id) : null).toEqual([7, 9]);
  });

  it("counts the published listings of those shops, and of no other", async () => {
    // A seller also shops: the listings table lets them read every public
    // product on the plaza, so the count is pinned to their own shop ids.
    const { calls } = fakeSupabase({
      tables: {
        shops: { data: [shopRow(7), shopRow(9)] },
        products: { data: [{ shop_id: 7 }, { shop_id: 7 }] },
      },
      shopLimit: 2,
    });

    const result = await getSellerShops();

    expect(calls).toContainEqual({ table: "products", method: "in", args: ["shop_id", [7, 9]] });
    expect(calls).toContainEqual({ table: "products", method: "eq", args: ["status", "published"] });
    expect(result?.status === "ready" ? result.shops.map((entry) => entry.publishedQuotaCount) : null).toEqual([2, 0]);
    expect(result).toMatchObject({ listingsLoaded: true });
  });

  it("says where each shop stands with administration", async () => {
    fakeSupabase({
      tables: {
        shops: {
          data: [
            shopRow(1),
            shopRow(2, { is_publishing_approved: false, publishing_reviewed_at: null }),
            shopRow(3, { is_publishing_approved: false }),
          ],
        },
      },
      shopLimit: 3,
    });

    const result = await getSellerShops();

    expect(result?.status === "ready" ? result.shops.map((entry) => entry.approval) : null).toEqual([
      "approved",
      "pending",
      "disabled",
    ]);
  });

  it.each([
    [1, 1, false],
    [1, 2, true],
    [0, 1, true],
    [0, 0, false],
  ])("with %i shops and a limit of %i, room for another is %s", async (owned, shopLimit, canCreateShop) => {
    fakeSupabase({ tables: { shops: { data: owned ? [shopRow(7)] : [] } }, shopLimit });

    await expect(getSellerShops()).resolves.toMatchObject({ canCreateShop, shopLimit });
  });

  it("assumes the ordinary limit of one when the limit cannot be read", async () => {
    fakeSupabase({ tables: { shops: { data: [shopRow(7)] } }, shopLimit: null });

    await expect(getSellerShops()).resolves.toMatchObject({ canCreateShop: false, shopLimit: 1 });
  });

  it("still lists the shops when their listings cannot be counted", async () => {
    fakeSupabase({
      tables: { shops: { data: [shopRow(7)] }, products: { data: null, error: { message: "boom" } } },
    });

    const result = await getSellerShops();

    expect(result).toMatchObject({ status: "ready", listingsLoaded: false });
    expect(result?.status === "ready" ? result.shops : []).toHaveLength(1);
  });

  it("does not ask for listings when there is no shop to count them for", async () => {
    const { client } = fakeSupabase();

    await expect(getSellerShops()).resolves.toMatchObject({ status: "ready", shops: [] });
    expect(client.from).not.toHaveBeenCalledWith("products");
  });

  it("reports a failed read instead of an empty list", async () => {
    // "You have no shops" to a seller who has three would be a lie.
    fakeSupabase({ tables: { shops: { data: null, error: { message: "boom" } } } });

    await expect(getSellerShops()).resolves.toEqual({ status: "error" });
  });
});
