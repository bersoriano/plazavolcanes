import { afterEach, describe, expect, it, vi } from "vitest";

import { getCart } from "@/lib/queries/orders.server";
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
      "id, shops!inner(id, name, slug), cart_items(id, product_id, quantity, products(id, name, price_mxn, image_path))",
    );
    expect(cart?.items).toEqual([
      {
        id: 31,
        productId: 12,
        quantity: 2,
        product: { id: 12, name: "Taza volcánica", price_mxn: 240, image_path: null },
      },
      { id: 32, productId: 13, quantity: 1, product: null },
    ]);
    expect(cart?.subtotal).toBe(480);
  });
});
