import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MEDIA_VARIANTS, mediaUrl, mediaUrls } from "@/lib/media/url";

const original = { ...process.env };

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MEDIA_BASE;
  delete process.env.NEXT_PUBLIC_MEDIA_RESIZE_BASE;
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

describe("resized variants", () => {
  it("asks the store to render the size a surface actually shows", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";

    expect(mediaUrl("products/seller-1/a.jpg", MEDIA_VARIANTS.card)).toBe(
      "https://abc.supabase.co/storage/v1/render/image/public/catalogo/products/seller-1/a.jpg?width=600&height=600&resize=contain&quality=75",
    );
  });

  it("fits the picture inside the box instead of cropping it to fill", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";

    // A renderer defaults to cropping, and crops on its own when only one
    // dimension arrives, so both dimensions and the mode go out every time.
    for (const variant of Object.values(MEDIA_VARIANTS)) {
      const url = mediaUrl("products/seller-1/a.jpg", variant)!;

      expect(url).toContain("resize=contain");
      expect(url).toContain(`height=${variant.height}`);
    }
  });

  it("squares the box when a variant gives only a width", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";

    expect(mediaUrl("products/seller-1/a.jpg", { width: 300 })).toContain("width=300&height=300");
  });

  it("carries an explicit quality through", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";

    expect(mediaUrl("products/seller-1/a.jpg", { width: 300, quality: 60 })).toContain(
      "quality=60",
    );
  });

  it("serves the original when the store cannot resize", () => {
    // A plain object host, such as a bucket behind a CDN with no renderer.
    process.env.NEXT_PUBLIC_MEDIA_BASE = "https://cdn.plazavolcanes.mx/catalogo";
    process.env.NEXT_PUBLIC_MEDIA_RESIZE_BASE = "";

    expect(mediaUrl("products/seller-1/a.jpg", { width: 600 })).toBe(
      "https://cdn.plazavolcanes.mx/catalogo/products/seller-1/a.jpg",
    );
  });

  it("uses a separately configured renderer when there is one", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE = "https://cdn.plazavolcanes.mx/catalogo";
    process.env.NEXT_PUBLIC_MEDIA_RESIZE_BASE = "https://img.plazavolcanes.mx/catalogo";

    expect(mediaUrl("products/seller-1/a.jpg", { width: 600 })).toBe(
      "https://img.plazavolcanes.mx/catalogo/products/seller-1/a.jpg?width=600&height=600&resize=contain&quality=75",
    );
  });

  it("escapes the key in a rendered URL too", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";

    expect(mediaUrl("products/seller-1/café.png", { width: 300 })).toContain("caf%C3%A9.png?");
  });

  it("applies the same variant across a batch", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";

    const urls = mediaUrls(["products/seller-1/a.jpg", "shops/seller-1/b.png"], { width: 300 });

    expect([...urls.values()].every((url) => url.includes("width=300"))).toBe(true);
  });

  it("still serves originals when no variant is asked for", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";

    expect(mediaUrl("products/seller-1/a.jpg")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/catalogo/products/seller-1/a.jpg",
    );
  });
});
