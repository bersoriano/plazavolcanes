import { afterEach, describe, expect, it, vi } from "vitest";

import { getSitemapCatalog } from "@/lib/queries/sitemap.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("getSitemapCatalog", () => {
  it("does not expose products whose effective publication gate is closed", async () => {
    const shopsQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };
    const productsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn((table: string) => (table === "products" ? productsQuery : shopsQuery)),
    } as never);

    const catalog = await getSitemapCatalog();

    expect(catalog.products).toEqual([]);
    expect(productsQuery.eq).toHaveBeenCalledWith("status", "published");
    expect(productsQuery.eq).toHaveBeenCalledWith("is_admin_enabled", true);
    expect(productsQuery.eq).toHaveBeenCalledWith("shops.is_publishing_approved", true);
    expect(productsQuery.not).toHaveBeenCalledWith("expires_at", "is", null);
    expect(productsQuery.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
  });
});
