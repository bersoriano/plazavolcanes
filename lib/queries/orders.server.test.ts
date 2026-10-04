import { afterEach, describe, expect, it, vi } from "vitest";

import { getCart, getSellerOrderQueue } from "@/lib/queries/orders.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("getCart", () => {
  it("preserves cart item ids when product visibility closes", async () => {
    const select = vi.fn();
    const query = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 20,
          shops: { id: 4, name: "Casa Niebla", slug: "casa-niebla" },
          cart_items: [
            {
              id: 31,
              product_id: 12,
              quantity: 2,
              products: { id: 12, name: "Taza volcánica", price_mxn: 240, image_path: null },
            },
            { id: 32, product_id: 13, quantity: 1, products: null },
          ],
        },
      }),
    };
    select.mockReturnValue(query);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "buyer-1" } } }) },
      from: vi.fn(() => ({ select })),
    } as never);

    const cart = await getCart(4);

    expect(select).toHaveBeenCalledWith(
      "id, shops!inner(id, name, slug), cart_items(id, product_id, quantity, products(id, name, price_mxn, image_path, units_available, currency_code))",
    );
    expect(cart?.items).toEqual([
      {
        id: 31,
        productId: 12,
        quantity: 2,
        // image_url is resolved by the query now, so the cart can show the
        // picture without the page re-deriving it from the storage path.
        product: { id: 12, name: "Taza volcánica", price_mxn: 240, image_path: null, image_url: null },
      },
      { id: 32, productId: 13, quantity: 1, product: null },
    ]);
    expect(cart?.subtotal).toBe(480);
  });
});

describe("getSellerOrderQueue", () => {
  type Result = { data?: unknown; error?: unknown; count?: number | null };
  type Recorded = { table: string; calls: unknown[][] };

  /**
   * A client that records every builder call and answers each query by what
   * it is: the seller's shops, a product-name search, the open orders, the
   * page of closed orders, or the count of closed orders.
   */
  function sellerClient(
    answers: { shops?: Result; items?: Result; open?: Result; closed?: Result; closedCount?: Result },
    userId: string | null = "seller-1",
  ) {
    const queries: Recorded[] = [];
    const answer = (query: Recorded): Result => {
      if (query.table === "shops") return answers.shops ?? { data: [shop] };
      if (query.table === "order_items") return answers.items ?? { data: [] };
      const select = query.calls.find(([method]) => method === "select");
      if ((select?.[2] as { head?: boolean } | undefined)?.head) return answers.closedCount ?? { count: 0 };
      if (query.calls.some(([method, column]) => method === "not" && column === "status")) return answers.closed ?? { data: [] };
      return answers.open ?? { data: [] };
    };
    const builder = (table: string) => {
      const query: Recorded = { table, calls: [] };
      queries.push(query);
      const proxy: Record<string, unknown> = new Proxy({}, {
        get(_target, property) {
          if (property === "then") {
            return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null, count: null, ...answer(query) }).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            query.calls.push([String(property), ...args]);
            return proxy;
          };
        },
      });
      return proxy;
    };
    const from = vi.fn(builder);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: userId ? { claims: { sub: userId } } : null }) },
      from,
    } as never);
    const ordersQueries = () => queries.filter((query) => query.table === "orders");
    const has = (query: Recorded, ...call: unknown[]) =>
      query.calls.some((recorded) => JSON.stringify(recorded) === JSON.stringify(call));
    return { from, queries, ordersQueries, has };
  }

  const shop = { id: 1, name: "Casa Niebla", slug: "casa-niebla" };
  const filter = { tab: "todos" as const, search: "", shopId: null, closedLimit: 20 };
  const now = new Date("2026-09-16T12:00:00.000Z");

  function orderRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 5,
      status: "accepted",
      subtotal: 100,
      currency_code: "MXN",
      created_at: "2026-09-11T00:00:00.000Z",
      shop_id: 1,
      fulfillment_method: "pickup",
      payment_confirmation_required: true,
      payment_completed_at: null,
      ship_by_at: "2026-09-18T20:30:00.000Z",
      delivered_at: null,
      decide_by_at: null,
      handling_time_zone: "America/Mexico_City",
      order_items: [],
      ...overrides,
    };
  }

  it("reads the seller's own shops' orders with what was ordered, and nothing about the buyer", async () => {
    const { ordersQueries, has } = sellerClient({
      open: {
        data: [
          orderRow({
            order_items: [
              { id: 9, product_name: "Jarra", quantity: 1, products: { image_path: "seller-1/jarra.webp" } },
              { id: 8, product_name: "Florero", quantity: 2, products: null },
            ],
          }),
        ],
      },
      closed: { data: [orderRow({ id: 3, status: "completed", created_at: "2026-09-01T00:00:00.000Z" })] },
      closedCount: { count: 1 },
    });

    const result = await getSellerOrderQueue({ now, filter });

    for (const query of ordersQueries()) {
      // Row-level security also shows a seller the orders they placed as a
      // buyer; pinning to their own shop ids keeps their shopping out.
      expect(has(query, "in", "shop_id", [1])).toBe(true);
    }
    const columns = String(ordersQueries()[0].calls.find(([method]) => method === "select")?.[1]);
    expect(columns).toContain("order_items(id, product_name, quantity, products(image_path))");
    expect(columns).not.toMatch(/buyer_id|address|alt_contact|phone|email|recipient|body/);

    expect(result).toMatchObject({
      status: "ready",
      now,
      shops: [{ id: 1, name: "Casa Niebla" }],
      counts: { todos: 2, actuar: 1, comprador: 0, cerrados: 1 },
      hasMoreClosed: false,
    });
    if (result?.status !== "ready") throw new Error("expected a ready queue");
    expect(result.orders.map((order) => order.id)).toEqual([5, 3]);
    expect(result.orders[0].shop).toEqual(shop);
    expect(result.orders[0].items.map(({ product_name, quantity }) => [product_name, quantity])).toEqual([
      ["Florero", 2],
      ["Jarra", 1],
    ]);
    expect(result.orders[0].items[0].image_url).toBeNull();
  });

  it("reads one closed order past the page to know whether there are more", async () => {
    const closed = Array.from({ length: 21 }, (_, index) => orderRow({ id: 100 + index, status: "completed" }));
    const { ordersQueries, has } = sellerClient({ closed: { data: closed }, closedCount: { count: 57 } });

    const result = await getSellerOrderQueue({ now, filter });

    expect(ordersQueries().some((query) => has(query, "range", 0, 20))).toBe(true);
    expect(result).toMatchObject({ hasMoreClosed: true, counts: { cerrados: 57 } });
    if (result?.status !== "ready") throw new Error("expected a ready queue");
    expect(result.orders).toHaveLength(20);
  });

  it("narrows to one of the seller's shops and ignores a shop that is not theirs", async () => {
    const shops = { data: [shop, { id: 3, name: "Otra", slug: "otra" }] };

    const mine = sellerClient({ shops });
    await getSellerOrderQueue({ now, filter: { ...filter, shopId: 3 } });
    expect(mine.ordersQueries().every((query) => mine.has(query, "in", "shop_id", [3]))).toBe(true);

    const foreign = sellerClient({ shops });
    await getSellerOrderQueue({ now, filter: { ...filter, shopId: 99 } });
    expect(foreign.ordersQueries().every((query) => foreign.has(query, "in", "shop_id", [1, 3]))).toBe(true);
  });

  it("finds an order by its number without searching product names", async () => {
    const { queries, ordersQueries, has } = sellerClient({});

    await getSellerOrderQueue({ now, filter: { ...filter, search: "#7" } });

    expect(queries.some((query) => query.table === "order_items")).toBe(false);
    expect(ordersQueries().every((query) => has(query, "in", "id", [7]))).toBe(true);
  });

  it("finds orders by product name within the seller's shops", async () => {
    const { queries, ordersQueries, has } = sellerClient({ items: { data: [{ order_id: 7 }, { order_id: 7 }, { order_id: 9 }] } });

    await getSellerOrderQueue({ now, filter: { ...filter, search: "flor" } });

    const search = queries.find((query) => query.table === "order_items")!;
    expect(has(search, "ilike", "product_name", "%flor%")).toBe(true);
    expect(has(search, "in", "orders.shop_id", [1])).toBe(true);
    expect(ordersQueries().every((query) => has(query, "in", "id", [7, 9]))).toBe(true);
  });

  it("reads no orders when a search matches nothing", async () => {
    const { ordersQueries } = sellerClient({ items: { data: [] } });

    const result = await getSellerOrderQueue({ now, filter: { ...filter, search: "nada" } });

    expect(ordersQueries()).toHaveLength(0);
    expect(result).toMatchObject({ orders: [], counts: { todos: 0, actuar: 0, comprador: 0, cerrados: 0 }, hasMoreClosed: false });
  });

  it("counts closed orders on a tab that does not list them, without reading them", async () => {
    const { ordersQueries, has } = sellerClient({ closedCount: { count: 4 } });

    const result = await getSellerOrderQueue({ now, filter: { ...filter, tab: "actuar" } });

    expect(ordersQueries().some((query) => query.calls.some(([method]) => method === "range"))).toBe(false);
    expect(ordersQueries().some((query) => has(query, "select", "id", { count: "exact", head: true }))).toBe(true);
    expect(result).toMatchObject({ counts: { cerrados: 4 } });
  });

  it("reports a failed read instead of an empty list", async () => {
    sellerClient({ open: { data: null, error: { message: "down" } } });
    await expect(getSellerOrderQueue({ now, filter })).resolves.toEqual({ status: "error" });

    sellerClient({ shops: { data: null, error: { message: "down" } } });
    await expect(getSellerOrderQueue({ now, filter })).resolves.toEqual({ status: "error" });
  });

  it("reads nothing without a signed-in seller", async () => {
    const { from } = sellerClient({}, null);

    await expect(getSellerOrderQueue({ now, filter })).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
