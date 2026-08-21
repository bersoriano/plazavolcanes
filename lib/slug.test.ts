import { describe, expect, it } from "vitest";

import { slugify, uniqueProductSlug, uniqueShopSlug } from "@/lib/slug";

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

describe("uniqueProductSlug", () => {
  it("returns the base slug when nothing claims it", async () => {
    await expect(uniqueProductSlug("Motorola Razr 5G", async () => false)).resolves.toBe(
      "motorola-razr-5g",
    );
  });

  it("walks past every taken suffix", async () => {
    const taken = new Set(["motorola-razr-5g", "motorola-razr-5g-2"]);

    await expect(
      uniqueProductSlug("Motorola Razr 5G", async (slug) => taken.has(slug)),
    ).resolves.toBe("motorola-razr-5g-3");
  });

  it("falls back when the name has nothing sluggable", async () => {
    await expect(uniqueProductSlug("¡!¿?", async () => false)).resolves.toBe("producto");
  });
});
