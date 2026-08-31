import { beforeEach, describe, expect, it, vi } from "vitest";

import { storeProductImages } from "@/lib/media/product-images";

type Row = { position: number };

function fakeClient({
  existing = [] as Row[],
  uploadFailsAt = -1,
  insertFailsAt = -1,
}) {
  const uploaded: string[] = [];
  const removed: string[][] = [];
  const inserted: { storage_path: string; position: number }[] = [];
  const deletedRowIds: number[][] = [];
  let uploads = 0;
  let inserts = 0;

  const client = {
    from: (table: string) => {
      if (table !== "product_images") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({ eq: async () => ({ data: existing, error: null }) }),
        insert: (row: { storage_path: string; position: number }) => ({
          select: () => ({
            single: async () => {
              const index = inserts;
              inserts += 1;
              if (index === insertFailsAt) return { data: null, error: { message: "boom" } };
              inserted.push(row);
              return { data: { id: 100 + index }, error: null };
            },
          }),
        }),
        delete: () => ({
          in: async (_column: string, ids: number[]) => {
            deletedRowIds.push(ids);
            return { error: null };
          },
        }),
      };
    },
    storage: {
      from: () => ({
        upload: async (key: string) => {
          const index = uploads;
          uploads += 1;
          if (index === uploadFailsAt) return { error: { message: "boom" } };
          uploaded.push(key);
          return { error: null };
        },
        remove: async (keys: string[]) => {
          removed.push(keys);
          return { error: null };
        },
      }),
    },
  };

  return { client, uploaded, removed, inserted, deletedRowIds };
}

function imageOf(name = "producto.jpg") {
  return new File([new Uint8Array(8)], name, { type: "image/jpeg" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (client: unknown) => client as any;

beforeEach(() => vi.clearAllMocks());

describe("storeProductImages", () => {
  it("fills the free slots left by a deleted image instead of counting rows", async () => {
    // Positions 0 and 2 are taken, so the next upload must land on 1, not on 2.
    const fake = fakeClient({ existing: [{ position: 0 }, { position: 2 }] });

    const result = await storeProductImages(asClient(fake.client), "seller-1", 42, [imageOf()]);

    expect(result.error).toBeNull();
    expect(fake.inserted.map((row) => row.position)).toEqual([1]);
  });

  it("keys every image under its owner and its product", async () => {
    const fake = fakeClient({});

    await storeProductImages(asClient(fake.client), "seller-1", 42, [imageOf(), imageOf()]);

    for (const key of fake.uploaded) {
      expect(key).toMatch(/^products\/seller-1\/42\/[0-9a-f-]{36}\.jpg$/);
    }
    expect(new Set(fake.uploaded).size).toBe(2);
  });

  it("refuses a batch that does not fit in the remaining slots", async () => {
    const fake = fakeClient({
      existing: [{ position: 0 }, { position: 1 }, { position: 2 }, { position: 3 }],
    });

    const result = await storeProductImages(asClient(fake.client), "seller-1", 42, [
      imageOf(),
      imageOf(),
    ]);

    expect(result.error).toBe("Puedes subir hasta 5 imágenes.");
    expect(fake.uploaded).toEqual([]);
  });

  it("undoes the rows already written when a later upload fails", async () => {
    const fake = fakeClient({ uploadFailsAt: 1 });

    const result = await storeProductImages(asClient(fake.client), "seller-1", 42, [
      imageOf(),
      imageOf(),
    ]);

    expect(result.error).toBe("No pudimos subir las imágenes.");
    expect(fake.deletedRowIds).toEqual([[100]]);
    expect(fake.removed).toEqual([fake.uploaded]);
  });

  it("undoes the whole batch when a row insert fails", async () => {
    const fake = fakeClient({ insertFailsAt: 1 });

    const result = await storeProductImages(asClient(fake.client), "seller-1", 42, [
      imageOf(),
      imageOf(),
    ]);

    expect(result.error).toBe("No pudimos guardar las imágenes.");
    // Both objects are gone, and the one row that did commit goes with them.
    expect(fake.deletedRowIds).toEqual([[100]]);
    expect(fake.removed[0]).toHaveLength(2);
  });

  it("does nothing when there is no image to store", async () => {
    const fake = fakeClient({});

    expect(await storeProductImages(asClient(fake.client), "seller-1", 42, [])).toEqual({
      error: null,
    });
    expect(fake.uploaded).toEqual([]);
  });
});
