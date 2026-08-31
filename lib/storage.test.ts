import { afterEach, describe, expect, it, vi } from "vitest";

import * as storage from "@/lib/storage";

const { validateImage, validateProductImages } = storage;

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

describe("signCatalogImagePaths", () => {
  afterEach(() => vi.restoreAllMocks());

  it("batches unique image paths into one five-minute signing request", async () => {
    const signCatalogImagePaths = (storage as unknown as {
      signCatalogImagePaths?: (
        client: unknown,
        paths: (string | null)[],
      ) => Promise<Map<string, string>>;
    }).signCatalogImagePaths;
    expect(typeof signCatalogImagePaths).toBe("function");

    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [
        {
          error: null,
          path: "seller/products/café.png",
          signedURL: "/object/sign/catalogo/seller/products/caf%C3%A9.png?token=token",
          signedUrl:
            "https://abc.supabase.co/storage/v1/object/sign/catalogo/seller/products/caf%C3%A9.png?token=token",
        },
        {
          error: "not found",
          path: "seller/products/missing.png",
          signedURL: null,
          signedUrl: null,
        },
      ],
      error: null,
    });
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({ createSignedUrls }),
      },
    };

    const urls = await signCatalogImagePaths!(client, [
      "seller/products/café.png",
      null,
      "seller/products/café.png",
      "seller/products/missing.png",
    ]);

    expect(client.storage.from).toHaveBeenCalledWith("catalogo");
    expect(createSignedUrls).toHaveBeenCalledWith(
      ["seller/products/café.png", "seller/products/missing.png"],
      300,
    );
    expect([...urls.entries()]).toEqual([
      [
        "seller/products/café.png",
        "https://abc.supabase.co/storage/v1/object/sign/catalogo/seller/products/caf%C3%A9.png?token=token",
      ],
    ]);
  });
});

describe("validateProductImages", () => {
  function imageOf(bytes: number, type = "image/jpeg") {
    return new File([new Uint8Array(bytes)], "producto.jpg", { type });
  }

  it("accepts up to five images of two megabytes each", () => {
    const files = Array.from({ length: 5 }, () => imageOf(2 * 1024 * 1024));

    expect(validateProductImages(files)).toBeNull();
  });

  it("rejects a sixth image", () => {
    const files = Array.from({ length: 6 }, () => imageOf(1024));

    expect(validateProductImages(files)).toBe("Puedes subir hasta 5 imágenes.");
  });

  it("rejects an image above two megabytes", () => {
    expect(validateProductImages([imageOf(2 * 1024 * 1024 + 1)])).toBe(
      "Cada imagen debe pesar 2 MB o menos.",
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
