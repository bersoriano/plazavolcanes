import { describe, expect, it } from "vitest";

import { productSchema, productStatusSchema } from "@/lib/validation/product";

describe("productSchema", () => {
  it("accepts a complete product and converts price to number", () => {
    const result = productSchema.safeParse({
      name: "Taza de barro",
      description: "Hecha a mano en un taller local de la región.",
      price_mxn: "349.00",
      status: "draft",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.price_mxn).toBe(349);
  });

  it("rejects short copy, negative price, and unknown status", () => {
    expect(
      productSchema.safeParse({
        name: "X",
        description: "corta",
        price_mxn: "-1",
        status: "public",
      }).success,
    ).toBe(false);
  });

  it("rejects more than two decimal places", () => {
    expect(
      productSchema.safeParse({
        name: "Taza de barro",
        description: "Hecha a mano en un taller local de la región.",
        price_mxn: "349.999",
        status: "published",
      }).success,
    ).toBe(false);
  });
});

describe("productStatusSchema", () => {
  it("accepts draft and published only", () => {
    expect(productStatusSchema.safeParse("draft").success).toBe(true);
    expect(productStatusSchema.safeParse("published").success).toBe(true);
    expect(productStatusSchema.safeParse("archived").success).toBe(false);
  });
});
