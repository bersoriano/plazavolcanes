import { describe, expect, it } from "vitest";

import { ORPHAN_GRACE_MS, sweepOrphanedImages } from "@/lib/media/orphans";

const NOW = Date.parse("2026-09-01T12:00:00.000Z");
const OLD = new Date(NOW - ORPHAN_GRACE_MS - 1000).toISOString();
const RECENT = new Date(NOW - 60_000).toISOString();

type Entry = { name: string; created_at: string };

function fakeClient({
  products = [] as Entry[],
  shops = [] as Entry[],
  galleryRows = [] as { storage_path: string }[],
  productRows = [] as { image_path: string | null }[],
  shopRows = [] as { image_path: string | null }[],
  queryFails = false,
} = {}) {
  const removed: string[][] = [];
  const asked: Record<string, string[]> = {};

  const client = {
    from: (table: string) => ({
      select: () => ({
        in: async (_column: string, keys: string[]) => {
          asked[table] = keys;
          if (queryFails) return { data: null, error: { message: "boom" } };
          if (table === "product_images") return { data: galleryRows, error: null };
          if (table === "products") return { data: productRows, error: null };
          return { data: shopRows, error: null };
        },
      }),
    }),
    storage: {
      from: () => ({
        list: async (prefix: string) => ({
          data: prefix.startsWith("products/") ? products : shops,
          error: null,
        }),
        remove: async (keys: string[]) => {
          removed.push(keys);
          return { error: null };
        },
      }),
    },
  };

  return { client, removed, asked };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (client: unknown) => client as any;

describe("sweepOrphanedImages", () => {
  it("deletes an old object nothing points at", async () => {
    const fake = fakeClient({ products: [{ name: "a.jpg", created_at: OLD }] });

    expect(await sweepOrphanedImages(asClient(fake.client), "seller-1", NOW)).toBe(1);
    expect(fake.removed).toEqual([["products/seller-1/a.jpg"]]);
  });

  it("leaves an object a gallery still points at", async () => {
    const fake = fakeClient({
      products: [{ name: "a.jpg", created_at: OLD }],
      galleryRows: [{ storage_path: "products/seller-1/a.jpg" }],
    });

    expect(await sweepOrphanedImages(asClient(fake.client), "seller-1", NOW)).toBe(0);
    expect(fake.removed).toEqual([]);
  });

  it("leaves an object a product cover points at", async () => {
    const fake = fakeClient({
      products: [{ name: "a.jpg", created_at: OLD }],
      productRows: [{ image_path: "products/seller-1/a.jpg" }],
    });

    expect(await sweepOrphanedImages(asClient(fake.client), "seller-1", NOW)).toBe(0);
  });

  it("leaves a shop picture alone", async () => {
    const fake = fakeClient({
      shops: [{ name: "b.png", created_at: OLD }],
      shopRows: [{ image_path: "shops/seller-1/b.png" }],
    });

    expect(await sweepOrphanedImages(asClient(fake.client), "seller-1", NOW)).toBe(0);
  });

  it("never touches an upload from a form somebody may still be filling in", async () => {
    const fake = fakeClient({ products: [{ name: "a.jpg", created_at: RECENT }] });

    expect(await sweepOrphanedImages(asClient(fake.client), "seller-1", NOW)).toBe(0);
    expect(fake.removed).toEqual([]);
  });

  it("does nothing when it cannot tell what is referenced", async () => {
    // Deleting somebody's live picture costs far more than keeping an orphan.
    const fake = fakeClient({
      products: [{ name: "a.jpg", created_at: OLD }],
      queryFails: true,
    });

    expect(await sweepOrphanedImages(asClient(fake.client), "seller-1", NOW)).toBe(0);
    expect(fake.removed).toEqual([]);
  });

  it("only ever asks about the caller's own folders", async () => {
    const fake = fakeClient({
      products: [{ name: "a.jpg", created_at: OLD }],
      shops: [{ name: "b.png", created_at: OLD }],
    });

    await sweepOrphanedImages(asClient(fake.client), "seller-1", NOW);

    for (const keys of Object.values(fake.asked)) {
      expect(keys.every((key) => key.includes("/seller-1/"))).toBe(true);
    }
    expect(fake.removed[0]).toEqual(["products/seller-1/a.jpg", "shops/seller-1/b.png"]);
  });

  it("ignores an entry with no usable timestamp", async () => {
    const fake = fakeClient({ products: [{ name: "a.jpg", created_at: "no es fecha" }] });

    expect(await sweepOrphanedImages(asClient(fake.client), "seller-1", NOW)).toBe(0);
  });
});
