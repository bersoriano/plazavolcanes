import { describe, expect, it } from "vitest";

import { productTranslationSchema } from "@/lib/validation/product-translation";

describe("productTranslationSchema", () => {
  it("normalizes a blank pair to null so an existing translation can be removed", () => {
    const result = productTranslationSchema.safeParse({ name: "  ", description: "" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("accepts and trims a complete English translation", () => {
    const result = productTranslationSchema.safeParse({
      name: "  Clay coffee mug  ",
      description: "  Handmade in a local workshop using regional clay.  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Clay coffee mug",
        description: "Handmade in a local workshop using regional clay.",
      });
    }
  });

  it.each([
    { name: "Clay coffee mug", description: "" },
    { name: "", description: "Handmade in a local workshop using regional clay." },
  ])("rejects an incomplete translation pair", (translation) => {
    expect(productTranslationSchema.safeParse(translation).success).toBe(false);
  });

  it("enforces product copy lengths when a translation is present", () => {
    expect(
      productTranslationSchema.safeParse({
        name: "No",
        description: "Too short",
      }).success,
    ).toBe(false);
    expect(
      productTranslationSchema.safeParse({
        name: "x".repeat(121),
        description: "x".repeat(3001),
      }).success,
    ).toBe(false);
  });
});
