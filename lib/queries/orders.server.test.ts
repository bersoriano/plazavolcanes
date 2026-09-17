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
  function sellerClient({ data, error = null, userId = "seller-1" }: { data: unknown; error?: unknown; userId?: string | null }) {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn().mockResolvedValue({ data, error }),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    const from = vi.fn(() => chain);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: userId ? { claims: { sub: userId } } : null }) },
      from,
    } as never);
    return { from, ...chain };
  }

  const shop = { id: 1, name: "Casa Niebla", slug: "casa-niebla", owner_id: "seller-1" };

  it("reads only orders placed in the seller's own shops, with what the next step needs", async () => {
    const { from, select, eq } = sellerClient({
      data: [
        {
          id: 5,
          status: "accepted",
          subtotal: 100,
          currency_code: "MXN",
          created_at: "2026-09-11T00:00:00.000Z",
          fulfillment_method: "pickup",
          payment_confirmation_required: true,
          payment_completed_at: null,
          ship_by_at: "2026-09-18T20:30:00.000Z",
          delivered_at: null,
          handling_time_zone: "America/Mexico_City",
          shops: shop,
        },
      ],
    });
    const now = new Date("2026-09-16T12:00:00.000Z");

    const result = await getSellerOrderQueue({ now });

    expect(from).toHaveBeenCalledWith("orders");
    // Row-level security also shows a seller the orders they placed as a buyer;
    // the owner filter is what keeps their shopping out of their sales.
    expect(eq).toHaveBeenCalledWith("shops.owner_id", "seller-1");
    const columns = String(select.mock.calls[0][0]);
    for (const column of ["shops!inner", "fulfillment_method", "payment_confirmation_required", "payment_completed_at", "ship_by_at", "delivered_at", "handling_time_zone"]) {
      expect(columns).toContain(column);
    }
    expect(columns).not.toMatch(/buyer_id|address|alt_contact|phone|email|recipient|body/);
    expect(result).toEqual({
      status: "ready",
      now,
      orders: [
        {
          id: 5,
          status: "accepted",
          subtotal: 100,
          currency_code: "MXN",
          created_at: "2026-09-11T00:00:00.000Z",
          fulfillment_method: "pickup",
          payment_confirmation_required: true,
          payment_completed_at: null,
          ship_by_at: "2026-09-18T20:30:00.000Z",
          delivered_at: null,
          handling_time_zone: "America/Mexico_City",
          shop: { id: 1, name: "Casa Niebla", slug: "casa-niebla" },
        },
      ],
    });
  });

  it("reports a failed read instead of an empty list", async () => {
    sellerClient({ data: null, error: { message: "down" } });

    await expect(getSellerOrderQueue()).resolves.toEqual({ status: "error" });
  });

  it("reads nothing without a signed-in seller", async () => {
    const { from } = sellerClient({ data: [], userId: null });

    await expect(getSellerOrderQueue()).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
