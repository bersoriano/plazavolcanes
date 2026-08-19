import { describe, expect, it } from "vitest";

import { slugify, uniqueShopSlug } from "@/lib/slug";

describe("slugify", () => {
  it("removes accents and punctuation", () => {
    expect(slugify("  Café del Volcán & Más  ")).toBe(
      "cafe-del-volcan-mas",
    );
  });
});

describe("uniqueShopSlug", () => {
  it("returns base slug when available", async () => {
    await expect(uniqueShopSlug("Casa Niebla", async () => false)).resolves.toBe(
      "casa-niebla",
    );
  });

  it("adds first available numeric suffix", async () => {
    const taken = new Set(["casa-niebla", "casa-niebla-2"]);

    await expect(
      uniqueShopSlug("Casa Niebla", async (slug) => taken.has(slug)),
    ).resolves.toBe("casa-niebla-3");
  });
});
