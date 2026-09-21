import { describe, expect, it } from "vitest";

import { productDraftSchema, productStatusSchema } from "@/lib/validation/product";

const blankForm = {
  name: "Taza de barro",
  description: "",
  price_mxn: "",
  condition: "",
  used_condition: "",
  category_id: "",
  handling_days: "",
  units_available: "",
  currency_code: "MXN",
  content_locale: "es-MX",
} as const;

describe("productDraftSchema", () => {
  it("keeps a half-written draft as the seller left it, inventing nothing", () => {
    const result = productDraftSchema.safeParse(blankForm);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Taza de barro",
        description: null,
        price_mxn: null,
        condition: null,
        used_condition: null,
        category_id: null,
        handling_days: null,
        units_available: null,
        currency_code: "MXN",
        content_locale: "es-MX",
      });
    }
  });

  it("still needs a name, because a draft nobody can tell apart is not usable", () => {
    const result = productDraftSchema.safeParse({ ...blankForm, name: "Ta" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toEqual([
        "El nombre debe tener entre 3 y 120 caracteres.",
      ]);
    }
  });

  it("refuses to store something that is not a price, draft or not", () => {
    expect(productDraftSchema.safeParse({ ...blankForm, price_mxn: "349.999" }).success).toBe(false);
    expect(productDraftSchema.safeParse({ ...blankForm, price_mxn: "barato" }).success).toBe(false);
  });

  it("accepts a used product whose subcondition is still undecided", () => {
    const result = productDraftSchema.safeParse({ ...blankForm, condition: "used" });

    expect(result.success && result.data.condition).toBe("used");
    expect(result.success && result.data.used_condition).toBeNull();
  });

  it("refuses a used subcondition on a product the seller called new", () => {
    const result = productDraftSchema.safeParse({
      ...blankForm,
      condition: "new",
      used_condition: "good",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.used_condition).toEqual([
        "Un producto nuevo no puede tener estado de uso.",
      ]);
    }
  });

  it("keeps out-of-range promises out of the row", () => {
    expect(productDraftSchema.safeParse({ ...blankForm, handling_days: "31" }).success).toBe(false);
    expect(productDraftSchema.safeParse({ ...blankForm, units_available: "11" }).success).toBe(false);
    expect(productDraftSchema.safeParse({ ...blankForm, units_available: "2.5" }).success).toBe(false);
  });

  it("carries complete values through untouched", () => {
    const result = productDraftSchema.safeParse({
      ...blankForm,
      description: "Taza hecha a mano con barro de alta temperatura.",
      price_mxn: "349.00",
      condition: "used",
      used_condition: "good",
      category_id: "11",
      handling_days: "5",
      units_available: "2",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        price_mxn: 349,
        condition: "used",
        used_condition: "good",
        category_id: 11,
        handling_days: 5,
        units_available: 2,
      });
    }
  });

  it("rejects unsupported currency and content locale values", () => {
    expect(
      productDraftSchema.safeParse({ ...blankForm, currency_code: "USD", content_locale: "en-US" })
        .success,
    ).toBe(false);
  });

  it("ignores a forged publication status", () => {
    const result = productDraftSchema.safeParse({ ...blankForm, status: "published" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("status");
  });
});

describe("productStatusSchema", () => {
  it("accepts draft and published only", () => {
    expect(productStatusSchema.safeParse("draft").success).toBe(true);
    expect(productStatusSchema.safeParse("published").success).toBe(true);
    expect(productStatusSchema.safeParse("archived").success).toBe(false);
  });
});
