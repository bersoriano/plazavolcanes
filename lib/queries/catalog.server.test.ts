import { afterEach, describe, expect, it, vi } from "vitest";

import { getHomeCatalog } from "@/lib/queries/catalog.server";
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
