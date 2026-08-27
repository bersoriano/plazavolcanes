import { describe, expect, it } from "vitest";

import { pickupPointSchema } from "@/lib/validation/shop";

const valid = {
  address_line1: "Av. Vallarta 1234",
  locality: "Zapopan",
  administrative_area_code: "MX-JAL",
  postal_code: "45010",
  notes: "Portón verde",
};

describe("pickupPointSchema", () => {
  it("accepts a complete pickup point", () => {
    expect(pickupPointSchema.safeParse(valid).success).toBe(true);
  });

  it("treats blank notes as absent", () => {
    const parsed = pickupPointSchema.parse({ ...valid, notes: "   " });
    expect(parsed.notes).toBeNull();
  });

  it("refuses a postal code that is not five digits", () => {
    const result = pickupPointSchema.safeParse({ ...valid, postal_code: "450" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("El código postal tiene 5 dígitos.");
  });

  it("refuses a state outside the supported list", () => {
    expect(pickupPointSchema.safeParse({ ...valid, administrative_area_code: "US-CA" }).success).toBe(false);
  });

  it("refuses a missing street", () => {
    const result = pickupPointSchema.safeParse({ ...valid, address_line1: "" });
    expect(result.success).toBe(false);
  });

  it("refuses notes longer than 500 characters", () => {
    expect(pickupPointSchema.safeParse({ ...valid, notes: "a".repeat(501) }).success).toBe(false);
  });
});
