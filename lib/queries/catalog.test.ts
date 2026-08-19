import { describe, expect, it } from "vitest";

import { normalizeSearchQuery } from "@/lib/queries/catalog";

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
