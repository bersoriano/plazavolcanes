import { describe, expect, it } from "vitest";

import { hasFullAddress, parsePickupPoint } from "@/lib/queries/checkout";

describe("parsePickupPoint", () => {
  it("returns null for a shop with no pickup point", () => {
    expect(parsePickupPoint(null)).toBeNull();
  });

  it("reads the coarse form", () => {
    const point = parsePickupPoint({ locality: "Zapopan", administrative_area_code: "MX-JAL" });
    expect(point).toEqual({ locality: "Zapopan", administrative_area_code: "MX-JAL" });
    expect(hasFullAddress(point)).toBe(false);
  });

  it("reads the full form once it is revealed", () => {
    const point = parsePickupPoint({
      locality: "Zapopan",
      administrative_area_code: "MX-JAL",
      address_line1: "Av. Vallarta 1234",
      postal_code: "45010",
      notes: null,
    });
    expect(hasFullAddress(point)).toBe(true);
    expect(point?.address_line1).toBe("Av. Vallarta 1234");
  });

  it("refuses a payload missing the coarse fields rather than guessing", () => {
    expect(parsePickupPoint({ address_line1: "Av. Vallarta 1234" })).toBeNull();
  });
});
