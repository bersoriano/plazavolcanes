import { afterEach, describe, expect, it, vi } from "vitest";

import { getHomeCatalog, getPublicShop } from "@/lib/queries/catalog.server";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/queries/categories.server", () => ({
  getProductCategoryTree: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("getHomeCatalog", () => {
  it("keeps selected shop location and tier evidence on catalog products", async () => {
    const productSelect = vi.fn();
    const productRows = [
      {
        id: 7,
        slug: "taza-de-barro-negro",
        units_available: 2,
        name: "Taza de barro negro",
        description: "Pieza hecha a mano en Oaxaca.",
        price_mxn: 480,
        condition: "new",
        used_condition: null,
        image_path: null,
        created_at: "2026-08-01T00:00:00.000Z",
        category_id: null,
        currency_code: "MXN",
        shops: {
          id: 3,
          owner_id: "00000000-0000-0000-0000-000000000003",
          name: "Taller Volcán",
          slug: "taller-volcan",
          country_code: "MX",
          administrative_area_codes: ["MX-OAX"],
          trust_tier: "reliable",
        },
        product_translations: [],
      },
    ];
    const productsQuery = {
      select: productSelect.mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: productRows }),
    };
    const shopsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn((table: string) => (table === "products" ? productsQuery : shopsQuery)),
    } as never);
    vi.mocked(getProductCategoryTree).mockResolvedValue([]);

    const result = await getHomeCatalog();

    expect(productSelect).toHaveBeenCalledWith(
      expect.stringContaining("administrative_area_codes, trust_tier"),
    );
    expect(result.products[0]?.shop).toEqual({
      name: "Taller Volcán",
      slug: "taller-volcan",
      country_code: "MX",
      administrative_area_codes: ["MX-OAX"],
      trust_tier: "reliable",
    });
  });
});

describe("getPublicShop", () => {
  it("carries the public seller name and positive trust context to checkout readers", async () => {
    const shop = {
      id: 4,
      owner_id: "seller-1",
      name: "Casa Niebla",
      slug: "casa-niebla",
      description: "Barro y cerámica local.",
      country_code: "MX",
      administrative_area_codes: ["MX-JAL"],
      image_path: null,
      trust_tier: "reliable",
    };
    const shopQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: shop, error: null }),
    };
    const productsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const trustProfileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { joined_on: "2025-01-15", verification_level: "basic" },
        error: null,
      }),
    };
    const shopRpc = vi.fn().mockResolvedValue({ data: "Elena Volcán", error: null });
    const shopClient = {
      from: vi.fn((table: string) => {
        if (table === "shops") return shopQuery;
        if (table === "products") return productsQuery;
        return trustProfileQuery;
      }),
      rpc: shopRpc,
    };
    const metricsRpc = vi.fn().mockResolvedValue({
      data: [{
        average_reply_time_minutes: 45,
        response_rate: 98,
        description_accuracy: 97,
        on_time_shipping_rate: 96,
        order_completion_rate: 99,
        dispute_rate: 0,
        total_orders: 32,
        average_rating: 4.8,
        review_count: 20,
        last_active_days_ago: 1,
        seller_active_days_ago: 1,
        evaluated_at: "2026-08-27T12:00:00Z",
      }],
      error: null,
    });
    vi.mocked(createServerSupabaseClient)
      .mockResolvedValueOnce(shopClient as never)
      .mockResolvedValueOnce({ rpc: metricsRpc } as never);

    const result = await getPublicShop("casa-niebla");

    expect(shopRpc).toHaveBeenCalledWith("shop_seller_display_name", { p_shop_id: 4 });
    expect(result).toEqual(expect.objectContaining({
      seller_display_name: "Elena Volcán",
      trust_profile: { joined_on: "2025-01-15", verification_level: "basic" },
      trust_metrics: expect.objectContaining({ responseRate: 98, totalOrders: 32 }),
    }));
  });
});
