import { describe, expect, it } from "vitest";

import { shopSchema } from "@/lib/validation/shop";

describe("shopSchema", () => {
  it("accepts a complete shop", () => {
    expect(
      shopSchema.safeParse({
        name: "Casa Niebla",
        description: "Objetos hechos en un taller al pie del volcán.",
      }).success,
    ).toBe(true);
  });

  it("rejects short names and descriptions", () => {
    const result = shopSchema.safeParse({ name: "X", description: "Corta" });

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
