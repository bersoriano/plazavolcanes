import { describe, expect, it } from "vitest";

import { normalizeCatalogFilters, normalizeSearchQuery } from "@/lib/queries/catalog";

describe("normalizeCatalogFilters", () => {
  it("normalizes URL search parameters into catalog filters", () => {
    expect(
      normalizeCatalogFilters({
        q: ["  iphone  "],
        categoria: "electronica",
        subcategoria: "celulares-y-accesorios",
      }),
    ).toEqual({
      query: "iphone",
      categorySlug: "electronica",
      subcategorySlug: "celulares-y-accesorios",
      locale: "es-MX",
      countryCode: "MX",
    });
  });

  it("rejects malformed category slugs", () => {
    expect(normalizeCatalogFilters({ categoria: "INVALID SLUG" }).categorySlug).toBeUndefined();
  });
});

describe("normalizeSearchQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeSearchQuery("  barro  ")).toBe("barro");
  });

  it("returns undefined for an empty query", () => {
    expect(normalizeSearchQuery("   ")).toBeUndefined();
    expect(normalizeSearchQuery(undefined)).toBeUndefined();
  });

  it("caps a query at 80 characters", () => {
    expect(normalizeSearchQuery("a".repeat(100))).toHaveLength(80);
  });
});
