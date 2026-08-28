import { describe, expect, it, vi } from "vitest";

import ShopManagePage from "@/app/panel/tiendas/[id]/page";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/queries/trust.server", () => ({ getShopTrustDashboard: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/actions/shops", () => ({ deleteShop: vi.fn(), updateShop: vi.fn() }));
vi.mock("@/components/shops/shop-form", () => ({ ShopForm: () => null }));

function chained(result: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

describe("seller pickup point read", () => {
  it("does not render an unchecked form when the pickup SELECT fails", async () => {
    const shopQuery = chained({
      data: {
        id: 4,
        owner_id: "seller-1",
        name: "Casa Niebla",
        slug: "casa-niebla",
        description: "Objetos hechos en un taller al pie del volcán.",
        image_path: null,
        country_code: "MX",
        administrative_area_codes: ["MX-JAL"],
      },
      error: null,
    });
    const pickupQuery = chained({
      data: null,
      error: { message: "connection reset" },
    });
    const productsQuery = chained({ data: [], error: null });

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "seller-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "shops") return shopQuery;
        if (table === "shop_pickup_points") return pickupQuery;
        return productsQuery;
      }),
    } as never);

    await expect(
      ShopManagePage({ params: Promise.resolve({ id: "4" }) }),
    ).rejects.toThrow("No pudimos consultar el punto de recolección.");
  });
});
