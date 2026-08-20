import { describe, expect, it } from "vitest";

import { checkoutSchema, quantitySchema } from "@/lib/validation/commerce";

describe("commerce validation", () => {
  it.each([1, 99])("accepts cart quantity %i", (quantity) => {
    expect(quantitySchema.parse(String(quantity))).toBe(quantity);
  });

  it.each([0, 100, "1.5", "x"])("rejects invalid cart quantity %s", (quantity) => {
    expect(quantitySchema.safeParse(String(quantity)).success).toBe(false);
  });

  it("normalizes a complete delivery address", () => {
    expect(checkoutSchema.parse({
      recipient: "  María López ",
      address_line1: " Calle Uno 10 ",
      address_line2: "",
      locality: " Guadalajara ",
      administrative_area: " Jalisco ",
      postal_code: " 44100 ",
      country_code: "MX",
      delivery_instructions: "",
      buyer_note: "",
      idempotency_key: "10000000-0000-4000-8000-000000000099",
    })).toEqual({
      recipient: "María López",
      address_line1: "Calle Uno 10",
      address_line2: null,
      locality: "Guadalajara",
      administrative_area: "Jalisco",
      postal_code: "44100",
      country_code: "MX",
      delivery_instructions: null,
      buyer_note: null,
      idempotency_key: "10000000-0000-4000-8000-000000000099",
    });
  });

  it("rejects checkout without required locality", () => {
    const result = checkoutSchema.safeParse({
      recipient: "María López",
      address_line1: "Calle Uno 10",
      locality: "",
      administrative_area: "Jalisco",
      postal_code: "44100",
      country_code: "MX",
      idempotency_key: "10000000-0000-4000-8000-000000000099",
    });
    expect(result.success).toBe(false);
  });
});
