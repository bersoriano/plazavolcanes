import { describe, expect, it } from "vitest";

import { categorySuggestionSchema } from "@/lib/validation/category";

describe("categorySuggestionSchema", () => {
  it("trims valid seller input and normalizes an empty root to null", () => {
    const result = categorySuggestionSchema.safeParse({
      suggested_name: "  Fotografía analógica  ",
      context: "  Cámaras, rollos y accesorios.  ",
      root_category_id: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        suggested_name: "Fotografía analógica",
        context: "Cámaras, rollos y accesorios.",
        root_category_id: null,
      });
    }
  });

  it.each(["ab", "x".repeat(81)])("rejects suggested name outside 3 to 80 characters", (name) => {
    expect(
      categorySuggestionSchema.safeParse({
        suggested_name: name,
        context: "",
        root_category_id: "",
      }).success,
    ).toBe(false);
  });

  it("rejects context longer than 500 characters", () => {
    expect(
      categorySuggestionSchema.safeParse({
        suggested_name: "Fotografía",
        context: "x".repeat(501),
        root_category_id: "",
      }).success,
    ).toBe(false);
  });

  it.each(["0", "-1", "1.5", "raíz"])("rejects non-positive or invalid root ID %s", (rootId) => {
    expect(
      categorySuggestionSchema.safeParse({
        suggested_name: "Fotografía",
        context: "",
        root_category_id: rootId,
      }).success,
    ).toBe(false);
  });
});
