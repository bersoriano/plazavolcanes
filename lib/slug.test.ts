import { describe, expect, it } from "vitest";

import {
  randomisedSlug,
  slugBelongsToName,
  slugify,
  uniqueProductSlug,
  uniqueShopSlug,
} from "@/lib/slug";

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

describe("randomisedSlug", () => {
  it("adds a suffix nobody could have guessed, and a different one each time", () => {
    const first = randomisedSlug("taza-de-barro");
    const second = randomisedSlug("taza-de-barro");

    expect(first).toMatch(/^taza-de-barro-[0-9a-f]{6}$/);
    expect(second).toMatch(/^taza-de-barro-[0-9a-f]{6}$/);
    expect(first).not.toBe(second);
  });
});

describe("slugBelongsToName", () => {
  it("recognises the slug a name was given", () => {
    expect(slugBelongsToName("taza-de-barro", "Taza de barro")).toBe(true);
    expect(slugBelongsToName("cafe-del-volcan", "Café del Volcán")).toBe(true);
  });

  it("recognises it with the suffix a taken slug was given", () => {
    expect(slugBelongsToName("taza-de-barro-2", "Taza de barro")).toBe(true);
    expect(slugBelongsToName("taza-de-barro-14", "Taza de barro")).toBe(true);
    expect(slugBelongsToName(randomisedSlug("taza-de-barro"), "Taza de barro")).toBe(true);
  });

  it("does not take a longer name's slug for a shorter name's", () => {
    // "Taza de barro grande" renamed to "Taza de barro" has to get a new slug.
    expect(slugBelongsToName("taza-de-barro-grande", "Taza de barro")).toBe(false);
    expect(slugBelongsToName("taza-de-barro-negro-2", "Taza de barro")).toBe(false);
  });

  it("does not recognise the slug of another name", () => {
    expect(slugBelongsToName("taza-anterior", "Taza de barro")).toBe(false);
    expect(slugBelongsToName("taza", "Taza de barro")).toBe(false);
  });

  it("falls back the way a new product's slug does when the name has nothing to keep", () => {
    expect(slugBelongsToName("producto", "!!!")).toBe(true);
    expect(slugBelongsToName("producto-2", "!!!")).toBe(true);
    expect(slugBelongsToName("taza", "!!!")).toBe(false);
  });
});
