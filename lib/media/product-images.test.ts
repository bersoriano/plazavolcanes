import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachProductImages } from "@/lib/media/product-images";

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const ZIP_HEADER = [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0];

/** Objects are read back over HTTP now, because the bytes never came through. */
function stubStorageContents(byKey: Record<string, number[]>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(byKey).find((candidate) => url.includes(candidate));
      if (!key) return { ok: false } as Response;

      return {
        ok: true,
        blob: async () => new Blob([new Uint8Array(byKey[key]!)]),
      } as unknown as Response;
    }),
  );
}

function fakeClient({ existing = [] as { position: number }[], insertFails = false } = {}) {
  const inserted: { storage_path: string; position: number }[] = [];
  const removed: string[][] = [];

  const client = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: existing, error: null }) }),
      insert: async (rows: { storage_path: string; position: number }[]) => {
        if (insertFails) return { error: { message: "boom" } };
        inserted.push(...rows);
        return { error: null };
      },
    }),
    storage: {
      from: () => ({
        remove: async (keys: string[]) => {
          removed.push(keys);
          return { error: null };
        },
      }),
    },
  };

  return { client, inserted, removed };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (client: unknown) => client as any;

// Objects are read back by URL, so the media origin has to be configured.
beforeEach(() => {
  process.env.NEXT_PUBLIC_MEDIA_BASE = "https://cdn.prueba.mx/catalogo";
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_MEDIA_BASE;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("attachProductImages", () => {
  it("records objects whose bytes match the format their key claims", async () => {
    const key = "products/seller-1/a.jpg";
    stubStorageContents({ [key]: JPEG_HEADER });
    const fake = fakeClient();

    const result = await attachProductImages(asClient(fake.client), "seller-1", 42, [key]);

    expect(result.error).toBeNull();
    expect(fake.inserted).toEqual([{ product_id: 42, storage_path: key, position: 0 }]);
  });

  it("refuses a key belonging to somebody else", async () => {
    const key = "products/otro-vendedor/a.jpg";
    stubStorageContents({ [key]: JPEG_HEADER });
    const fake = fakeClient();

    const result = await attachProductImages(asClient(fake.client), "seller-1", 42, [key]);

    expect(result.error).toBe("No pudimos guardar las imágenes.");
    expect(fake.inserted).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("deletes an object whose bytes are not an image at all", async () => {
    const key = "products/seller-1/a.jpg";
    stubStorageContents({ [key]: ZIP_HEADER });
    const fake = fakeClient();

    const result = await attachProductImages(asClient(fake.client), "seller-1", 42, [key]);

    expect(result.error).toBe("Usa una imagen JPEG, PNG o WebP.");
    expect(fake.removed).toEqual([[key]]);
    expect(fake.inserted).toEqual([]);
  });

  it("deletes an object whose bytes disagree with its extension", async () => {
    // A PNG uploaded under a .jpg key would be served with the wrong type.
    const key = "products/seller-1/a.jpg";
    stubStorageContents({ [key]: PNG_HEADER });
    const fake = fakeClient();

    const result = await attachProductImages(asClient(fake.client), "seller-1", 42, [key]);

    expect(result.error).toBeTruthy();
    expect(fake.removed).toEqual([[key]]);
  });

  it("deletes an object that is not there", async () => {
    stubStorageContents({});
    const fake = fakeClient();

    const result = await attachProductImages(asClient(fake.client), "seller-1", 42, [
      "products/seller-1/a.jpg",
    ]);

    expect(result.error).toBeTruthy();
    expect(fake.inserted).toEqual([]);
  });

  it("fills the slots a removed image left free", async () => {
    const key = "products/seller-1/a.jpg";
    stubStorageContents({ [key]: JPEG_HEADER });
    const fake = fakeClient({ existing: [{ position: 0 }, { position: 2 }] });

    await attachProductImages(asClient(fake.client), "seller-1", 42, [key]);

    expect(fake.inserted[0]!.position).toBe(1);
  });

  it("refuses a batch that does not fit in the remaining slots", async () => {
    const fake = fakeClient({
      existing: [{ position: 0 }, { position: 1 }, { position: 2 }, { position: 3 }],
    });
    stubStorageContents({});

    const result = await attachProductImages(asClient(fake.client), "seller-1", 42, [
      "products/seller-1/a.jpg",
      "products/seller-1/b.jpg",
    ]);

    expect(result.error).toBe("Puedes subir hasta 5 imágenes.");
  });

  it("removes the objects when the rows cannot be written", async () => {
    const key = "products/seller-1/a.jpg";
    stubStorageContents({ [key]: JPEG_HEADER });
    const fake = fakeClient({ insertFails: true });

    const result = await attachProductImages(asClient(fake.client), "seller-1", 42, [key]);

    expect(result.error).toBe("No pudimos guardar las imágenes.");
    expect(fake.removed).toEqual([[key]]);
  });

  it("does nothing when there is no key", async () => {
    const fake = fakeClient();

    expect(await attachProductImages(asClient(fake.client), "seller-1", 42, [])).toEqual({
      error: null,
    });
  });
});
