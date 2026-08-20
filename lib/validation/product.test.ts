import { describe, expect, it } from "vitest";

import { productSchema, productStatusSchema } from "@/lib/validation/product";

describe("productSchema", () => {
  it.each([1, 30])("accepts handling promise of %i business days", (handlingDays) => {
    const result = productSchema.safeParse({
      name: "Taza volcánica",
      description: "Taza hecha a mano con barro de alta temperatura.",
      price_mxn: "349.00",
      status: "draft",
      condition: "new",
      used_condition: "",
      category_id: "",
      handling_days: String(handlingDays),
      currency_code: "MXN",
      content_locale: "es-MX",
    });
    expect(result.success && result.data.handling_days).toBe(handlingDays);
  });

  it.each([0, 31])("rejects handling promise of %i business days", (handlingDays) => {
    const result = productSchema.safeParse({
      name: "Taza volcánica",
      description: "Taza hecha a mano con barro de alta temperatura.",
      price_mxn: "349.00",
      status: "draft",
      condition: "new",
      used_condition: "",
      category_id: "",
      handling_days: String(handlingDays),
      currency_code: "MXN",
      content_locale: "es-MX",
    });
    expect(result.success).toBe(false);
  });
  const completeProduct = {
    name: "Taza de barro",
    description: "Hecha a mano en un taller local de la región.",
    price_mxn: "349.00",
    status: "draft",
    category_id: "",
    currency_code: "MXN",
    content_locale: "es-MX",
  } as const;

  it("accepts a complete product and converts price to number", () => {
    const result = productSchema.safeParse({
      name: "Taza de barro",
      description: "Hecha a mano en un taller local de la región.",
      price_mxn: "349.00",
      status: "draft",
      condition: "new",
      used_condition: "",
      category_id: "",
      currency_code: "MXN",
      content_locale: "es-MX",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        price_mxn: 349,
        category_id: null,
        currency_code: "MXN",
        content_locale: "es-MX",
      });
    }
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
        condition: "new",
        used_condition: "",
        category_id: "22",
        currency_code: "MXN",
        content_locale: "es-MX",
      }).success,
    ).toBe(false);
  });

  it("accepts a new product without a used subcondition", () => {
    const result = productSchema.safeParse({
      ...completeProduct,
      condition: "new",
      used_condition: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.condition).toBe("new");
      expect(result.data.used_condition).toBeNull();
    }
  });

  it("rejects a used product without a used subcondition", () => {
    expect(
      productSchema.safeParse({
        ...completeProduct,
        condition: "used",
        used_condition: "",
      }).success,
    ).toBe(false);
  });

  it.each(["mint", "good", "fair", "bad", "scrap"] as const)(
    "accepts used condition %s",
    (usedCondition) => {
      const result = productSchema.safeParse({
        ...completeProduct,
        condition: "used",
        used_condition: usedCondition,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.condition).toBe("used");
        expect(result.data.used_condition).toBe(usedCondition);
      }
    },
  );

  it("rejects a used subcondition when product is new", () => {
    expect(
      productSchema.safeParse({
        ...completeProduct,
        condition: "new",
        used_condition: "good",
      }).success,
    ).toBe(false);
  });

  it("accepts a draft without a category", () => {
    const result = productSchema.safeParse({
      ...completeProduct,
      condition: "new",
      used_condition: "",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.category_id).toBeNull();
  });

  it("rejects publication without a category using seller-facing copy", () => {
    const result = productSchema.safeParse({
      ...completeProduct,
      status: "published",
      condition: "new",
      used_condition: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.category_id).toEqual([
        "Selecciona una subcategoría válida antes de publicar.",
      ]);
    }
  });

  it("rejects unsupported currency and content locale values", () => {
    expect(
      productSchema.safeParse({
        ...completeProduct,
        condition: "new",
        used_condition: "",
        currency_code: "USD",
        content_locale: "en-US",
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
