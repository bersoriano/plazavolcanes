import { describe, expect, it } from "vitest";

import { shopSchema } from "@/lib/validation/shop";

describe("shopSchema", () => {
  it("accepts a complete shop", () => {
    expect(
      shopSchema.safeParse({
        name: "Casa Niebla",
        description: "Objetos hechos en un taller al pie del volcán.",
        country_code: "MX",
        administrative_area_code: "MX-JAL",
      }).success,
    ).toBe(true);
  });

  it("requires a supported Mexican state", () => {
    const missingState = shopSchema.safeParse({
      name: "Casa Niebla",
      description: "Objetos hechos en un taller al pie del volcán.",
      country_code: "MX",
      administrative_area_code: "",
    });
    const unsupportedState = shopSchema.safeParse({
      name: "Casa Niebla",
      description: "Objetos hechos en un taller al pie del volcán.",
      country_code: "MX",
      administrative_area_code: "US-CA",
    });

    expect(missingState.success).toBe(false);
    expect(unsupportedState.success).toBe(false);
    if (!missingState.success) {
      expect(missingState.error.flatten().fieldErrors.administrative_area_code?.[0]).toBe(
        "Selecciona un estado.",
      );
    }
  });

  it("rejects unsupported countries", () => {
    const result = shopSchema.safeParse({
      name: "Casa Niebla",
      description: "Objetos hechos en un taller al pie del volcán.",
      country_code: "US",
      administrative_area_code: "US-CA",
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
      administrative_area_code: "MX-JAL",
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
