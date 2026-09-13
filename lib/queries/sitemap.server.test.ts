import { afterEach, describe, expect, it, vi } from "vitest";

import type { CategoryTree } from "@/lib/categories";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { getSitemapCatalog, hasPublishedProducts } from "@/lib/queries/sitemap.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/queries/categories.server", () => ({ getProductCategoryTree: vi.fn(async () => []) }));

const tree: CategoryTree[] = [
  {
    id: 1,
    parentId: null,
    slug: "electronica",
    name: "Electrónica",
    sortOrder: 1,
    isActive: true,
    children: [
      { id: 11, parentId: 1, slug: "celulares", name: "Celulares", sortOrder: 1, isActive: true },
      { id: 12, parentId: 1, slug: "audio", name: "Audio", sortOrder: 2, isActive: true },
    ],
  },
  {
    id: 2,
    parentId: null,
    slug: "mascotas",
    name: "Mascotas",
    sortOrder: 2,
    isActive: true,
    children: [{ id: 21, parentId: 2, slug: "perros", name: "Perros", sortOrder: 1, isActive: true }],
  },
];

/** A query builder whose filters chain and whose last call resolves to `result`. */
function chain(result: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "not", "gt", "in", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.limit = vi.fn(async () => result);
  (query as unknown as PromiseLike<unknown>).then = ((resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)) as never;
  return query;
}

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

  it("lists a category page only where something is published under it", async () => {
    vi.mocked(getProductCategoryTree).mockResolvedValue(tree);
    const productsQuery = chain({
      data: [
        { slug: "funda", updated_at: "2026-08-01T00:00:00.000Z", category_id: 11 },
        { slug: "otra-funda", updated_at: "2026-08-02T00:00:00.000Z", category_id: 11 },
      ],
    });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn((table: string) => (table === "products" ? productsQuery : chain({ data: [] }))),
    } as never);

    const catalog = await getSitemapCatalog();

    expect(catalog.categoryPaths).toEqual(["/?categoria=electronica", "/?categoria=electronica&subcategoria=celulares"]);
    expect(catalog.products).toEqual([
      { slug: "funda", updatedAt: "2026-08-01T00:00:00.000Z" },
      { slug: "otra-funda", updatedAt: "2026-08-02T00:00:00.000Z" },
    ]);
  });
});

describe("hasPublishedProducts", () => {
  it("counts only public products filed under the given categories", async () => {
    const query = chain({ count: 2 });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: vi.fn(() => query) } as never);

    await expect(hasPublishedProducts([11, 12])).resolves.toBe(true);
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("shops!inner"), { count: "exact", head: true });
    expect(query.in).toHaveBeenCalledWith("category_id", [11, 12]);
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.eq).toHaveBeenCalledWith("is_admin_enabled", true);
    expect(query.eq).toHaveBeenCalledWith("shops.is_publishing_approved", true);
    expect(query.not).toHaveBeenCalledWith("expires_at", "is", null);
    expect(query.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
  });

  it("answers no for an empty count or no categories, without asking for the latter", async () => {
    const query = chain({ count: 0 });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: vi.fn(() => query) } as never);

    await expect(hasPublishedProducts([11])).resolves.toBe(false);
    vi.mocked(createServerSupabaseClient).mockClear();
    await expect(hasPublishedProducts([])).resolves.toBe(false);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
