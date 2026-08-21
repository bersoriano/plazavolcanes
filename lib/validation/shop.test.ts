import { describe, expect, it } from "vitest";

import { shopSchema } from "@/lib/validation/shop";

const baseShop = {
  name: "Casa Niebla",
  description: "Objetos hechos en un taller al pie del volcán.",
  country_code: "MX",
};

describe("shopSchema", () => {
  it("accepts a shop with a single state", () => {
    expect(
      shopSchema.safeParse({ ...baseShop, administrative_area_codes: ["MX-JAL"] }).success,
    ).toBe(true);
  });

  it("accepts a shop with two states", () => {
    expect(
      shopSchema.safeParse({
        ...baseShop,
        administrative_area_codes: ["MX-JAL", "MX-COL"],
      }).success,
    ).toBe(true);
  });

  it("requires at least one supported Mexican state", () => {
    const missingState = shopSchema.safeParse({
      ...baseShop,
      administrative_area_codes: [],
    });
    const unsupportedState = shopSchema.safeParse({
      ...baseShop,
      administrative_area_codes: ["US-CA"],
    });

    expect(unsupportedState.success).toBe(false);
    expect(missingState.success).toBe(false);
    if (!missingState.success) {
      expect(missingState.error.flatten().fieldErrors.administrative_area_codes?.[0]).toBe(
        "Selecciona un estado.",
      );
    }
  });

  it("rejects more than two states", () => {
    const result = shopSchema.safeParse({
      ...baseShop,
      administrative_area_codes: ["MX-JAL", "MX-COL", "MX-OAX"],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.administrative_area_codes?.[0]).toBe(
        "Puedes elegir hasta 2 estados.",
      );
    }
  });

  it("rejects the same state twice", () => {
    const result = shopSchema.safeParse({
      ...baseShop,
      administrative_area_codes: ["MX-JAL", "MX-JAL"],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.administrative_area_codes?.[0]).toBe(
        "Elige dos estados distintos.",
      );
    }
  });

  it("rejects unsupported countries", () => {
    const result = shopSchema.safeParse({
      ...baseShop,
      country_code: "US",
      administrative_area_codes: ["MX-JAL"],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.country_code?.[0]).toBe(
        "País no disponible.",
      );
    }
  });

  it("rejects short names and descriptions", () => {
    const result = shopSchema.safeParse({
      name: "X",
      description: "Corta",
      country_code: "MX",
      administrative_area_codes: ["MX-JAL"],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name?.[0]).toBe(
        "El nombre debe tener entre 3 y 80 caracteres.",
      );
      expect(result.error.flatten().fieldErrors.description?.[0]).toBe(
        "La descripción debe tener entre 20 y 1200 caracteres.",
      );
    }
  });
});
