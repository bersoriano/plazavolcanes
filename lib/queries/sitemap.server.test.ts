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
    const rows = [
      {
        slug: "taza-pendiente",
        updated_at: "2026-08-01T00:00:00.000Z",
        status: "published",
        is_admin_enabled: true,
        expires_at: "2026-09-01T00:00:00.000Z",
        shops: { is_publishing_approved: false },
      },
      {
        slug: "taza-deshabilitada",
        updated_at: "2026-08-01T00:00:00.000Z",
        status: "published",
        is_admin_enabled: false,
        expires_at: "2026-09-01T00:00:00.000Z",
        shops: { is_publishing_approved: true },
      },
    ];
    const filters = new Map<string, unknown>();
    let requiresExpiry = false;
    const productsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(function (column: string, value: unknown) {
        filters.set(column, value);
        return productsQuery;
      }),
      not: vi.fn(function (column: string, operator: string, value: unknown) {
        requiresExpiry = column === "expires_at" && operator === "is" && value === null;
        return productsQuery;
      }),
      gt: vi.fn(function () {
        return productsQuery;
      }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(async () => ({
        data: rows.filter((row) =>
          (!filters.has("status") || row.status === filters.get("status")) &&
          (!filters.has("is_admin_enabled") || row.is_admin_enabled === filters.get("is_admin_enabled")) &&
          (!filters.has("shops.is_publishing_approved") ||
            row.shops.is_publishing_approved === filters.get("shops.is_publishing_approved")) &&
          (!requiresExpiry || row.expires_at !== null),
        ),
      })),
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
