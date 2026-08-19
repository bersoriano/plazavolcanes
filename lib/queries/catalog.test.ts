import { describe, expect, it } from "vitest";

import {
  escapePostgresLikePattern,
  normalizeCatalogFilters,
  normalizeSearchQuery,
} from "@/lib/queries/catalog";

describe("escapePostgresLikePattern", () => {
  it("escapes PostgreSQL LIKE wildcards", () => {
    expect(escapePostgresLikePattern("100%_literal")).toBe(String.raw`100\%\_literal`);
  });

  it("escapes existing backslashes before LIKE wildcards", () => {
    expect(escapePostgresLikePattern(String.raw`\%_`)).toBe(String.raw`\\\%\_`);
  });
});

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
      invalidCategorySelection: false,
    });
  });

  it("rejects malformed category slugs", () => {
    expect(normalizeCatalogFilters({ categoria: "INVALID SLUG" })).toMatchObject({
      categorySlug: undefined,
      invalidCategorySelection: true,
    });
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
