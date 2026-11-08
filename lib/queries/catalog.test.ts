import { describe, expect, it } from "vitest";

import {
  escapePostgresLikePattern,
  normalizeCatalogFilters,
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
    ).toMatchObject({
      criteria: { text: "iphone" },
      query: "iphone",
      categorySlug: "electronica",
      subcategorySlug: "celulares-y-accesorios",
      administrativeAreaSlug: undefined,
      administrativeAreaCode: undefined,
      locale: "es-MX",
      countryCode: "MX",
      invalidCategorySelection: false,
      invalidAreaSelection: false,
    });
  });

  it("rejects malformed category slugs", () => {
    expect(normalizeCatalogFilters({ categoria: "INVALID SLUG" })).toMatchObject({
      categorySlug: undefined,
      invalidCategorySelection: true,
    });
  });
});

it("rejects an oversized request instead of losing its price limit", () => {
  const filters = normalizeCatalogFilters({ q: "a".repeat(500) + " under $100" });
  expect(filters.searchError).toBeTruthy();
});

describe("normalizeCatalogFilters state selection", () => {
  it("keeps a supported state slug", () => {
    expect(normalizeCatalogFilters({ estado: "jalisco" })).toMatchObject({
      administrativeAreaSlug: "jalisco",
      administrativeAreaCode: "MX-JAL",
      invalidAreaSelection: false,
    });
  });

  it("flags a state outside the supported catalog", () => {
    expect(normalizeCatalogFilters({ estado: "california" })).toMatchObject({
      administrativeAreaSlug: undefined,
      administrativeAreaCode: undefined,
      invalidAreaSelection: true,
    });
  });

  it("leaves the state empty when the parameter is absent", () => {
    expect(normalizeCatalogFilters({})).toMatchObject({
      administrativeAreaSlug: undefined,
      administrativeAreaCode: undefined,
      invalidAreaSelection: false,
    });
  });
});
