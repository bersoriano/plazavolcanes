import { afterEach, describe, expect, it, vi } from "vitest";

import { getCatalogImageUrl, validateImage } from "@/lib/storage";

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

describe("getCatalogImageUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("builds a public URL and safely encodes each path segment", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_live",
    );

    expect(getCatalogImageUrl("seller/shops/café.png")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/catalogo/seller/shops/caf%C3%A9.png",
    );
  });

  it("returns null without an image path", () => {
    expect(getCatalogImageUrl(null)).toBeNull();
  });
});
