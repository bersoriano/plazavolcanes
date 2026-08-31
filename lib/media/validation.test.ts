import { describe, expect, it } from "vitest";

import { validateImage, validateProductImages } from "@/lib/media/validation";

describe("validateImage", () => {
  it("accepts JPEG, PNG, and WebP up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      const file = new File(["imagen"], "producto", { type });
      expect(validateImage(file)).toBeNull();
    }
  });

  it("rejects unsupported formats", () => {
    const file = new File(["imagen"], "producto.gif", { type: "image/gif" });
    expect(validateImage(file)).toBe("Usa una imagen JPEG, PNG o WebP.");
  });

  it("rejects images above 5 MB", () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.jpg", {
      type: "image/jpeg",
    });
    expect(validateImage(file)).toBe("La imagen debe pesar 5 MB o menos.");
  });
});

describe("validateProductImages", () => {
  function imageOf(bytes: number, type = "image/jpeg") {
    return new File([new Uint8Array(bytes)], "producto.jpg", { type });
  }

  it("accepts up to five images of one megabyte each", () => {
    const files = Array.from({ length: 5 }, () => imageOf(1024 * 1024));

    expect(validateProductImages(files)).toBeNull();
  });

  it("rejects a sixth image", () => {
    const files = Array.from({ length: 6 }, () => imageOf(1024));

    expect(validateProductImages(files)).toBe("Puedes subir hasta 5 imágenes.");
  });

  it("rejects an image above one megabyte", () => {
    expect(validateProductImages([imageOf(1024 * 1024 + 1)])).toBe(
      "Cada imagen debe pesar 1 MB o menos.",
    );
  });

  it("rejects an unsupported format", () => {
    expect(validateProductImages([imageOf(1024, "image/gif")])).toBe(
      "Usa una imagen JPEG, PNG o WebP.",
    );
  });

  it("counts images already stored against the limit", () => {
    const files = Array.from({ length: 3 }, () => imageOf(1024));

    expect(validateProductImages(files, 3)).toBe("Puedes subir hasta 5 imágenes.");
    expect(validateProductImages(files, 2)).toBeNull();
  });

  it("accepts an empty selection", () => {
    expect(validateProductImages([])).toBeNull();
  });
});
