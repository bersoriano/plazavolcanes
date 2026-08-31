import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mediaUrl, mediaUrls } from "@/lib/media/url";

const original = { ...process.env };

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MEDIA_BASE;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
});

afterEach(() => {
  process.env = { ...original };
});

describe("mediaUrl", () => {
  it("builds a URL from the configured media base and the storage key", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE = "https://cdn.plazavolcanes.mx/catalogo";

    expect(mediaUrl("products/seller-1/42/abc.jpg")).toBe(
      "https://cdn.plazavolcanes.mx/catalogo/products/seller-1/42/abc.jpg",
    );
  });

  it("ignores a trailing slash on the base", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE = "https://cdn.plazavolcanes.mx/catalogo/";

    expect(mediaUrl("shops/seller-1/abc.png")).toBe(
      "https://cdn.plazavolcanes.mx/catalogo/shops/seller-1/abc.png",
    );
  });

  it("escapes each key segment without escaping the separators", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE = "https://cdn.plazavolcanes.mx/catalogo";

    expect(mediaUrl("products/seller-1/42/café.png")).toBe(
      "https://cdn.plazavolcanes.mx/catalogo/products/seller-1/42/caf%C3%A9.png",
    );
  });

  it("falls back to the Supabase public bucket until a media base is deployed", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";

    expect(mediaUrl("products/seller-1/42/abc.jpg")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/catalogo/products/seller-1/42/abc.jpg",
    );
  });

  it("returns null when nothing is configured", () => {
    expect(mediaUrl("products/seller-1/42/abc.jpg")).toBeNull();
  });
});

describe("mediaUrls", () => {
  it("maps every key once and drops the blanks", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE = "https://cdn.plazavolcanes.mx/catalogo";

    const urls = mediaUrls([
      "products/seller-1/42/a.jpg",
      null,
      "products/seller-1/42/a.jpg",
      undefined,
      "shops/seller-1/b.png",
    ]);

    expect([...urls.entries()]).toEqual([
      ["products/seller-1/42/a.jpg", "https://cdn.plazavolcanes.mx/catalogo/products/seller-1/42/a.jpg"],
      ["shops/seller-1/b.png", "https://cdn.plazavolcanes.mx/catalogo/shops/seller-1/b.png"],
    ]);
  });

  it("is empty when no key is given", () => {
    expect(mediaUrls([null, undefined]).size).toBe(0);
  });
});
