import { describe, expect, it } from "vitest";

import {
  mapAdminMarketplaceUsers,
  type AdminMarketplaceRpcRow,
} from "@/lib/queries/admin";

const base: AdminMarketplaceRpcRow = {
  user_id: "user-1",
  email: "seller@test.local",
  user_created_at: "2026-08-03T00:00:00.000Z",
  display_name: "María Taller",
  shop_id: 10,
  shop_name: "Taller Volcán",
  shop_slug: "taller-volcan",
  shop_created_at: "2026-08-04T00:00:00.000Z",
  product_id: 20,
  product_name: "Taza",
  product_slug: "taza",
  product_status: "published",
  product_created_at: "2026-08-05T00:00:00.000Z",
  product_updated_at: "2026-08-06T00:00:00.000Z",
};

describe("mapAdminMarketplaceUsers", () => {
  it("groups repeated flat rows into an exact nested shape", () => {
    const users = mapAdminMarketplaceUsers([
      base,
      {
        ...base,
        product_id: 21,
        product_name: "Plato",
        product_slug: "plato",
        product_status: "draft",
      },
      base,
    ]);

    expect(users).toEqual([
      {
        id: "user-1",
        email: "seller@test.local",
        displayName: "María Taller",
        createdAt: "2026-08-03T00:00:00.000Z",
        shops: [
          {
            id: 10,
            name: "Taller Volcán",
            slug: "taller-volcan",
            createdAt: "2026-08-04T00:00:00.000Z",
            products: [
              {
                id: 20,
                name: "Taza",
                slug: "taza",
                status: "published",
                createdAt: "2026-08-05T00:00:00.000Z",
                updatedAt: "2026-08-06T00:00:00.000Z",
              },
              {
                id: 21,
                name: "Plato",
                slug: "plato",
                status: "draft",
                createdAt: "2026-08-05T00:00:00.000Z",
                updatedAt: "2026-08-06T00:00:00.000Z",
              },
            ],
          },
        ],
      },
    ]);
  });

  it("preserves users without shops and shops without products", () => {
    const users = mapAdminMarketplaceUsers([
      {
        ...base,
        user_id: "user-2",
        email: null,
        shop_id: null,
        shop_name: null,
        shop_slug: null,
        shop_created_at: null,
        product_id: null,
        product_name: null,
        product_slug: null,
        product_status: null,
        product_created_at: null,
        product_updated_at: null,
      },
      {
        ...base,
        product_id: null,
        product_name: null,
        product_slug: null,
        product_status: null,
        product_created_at: null,
        product_updated_at: null,
      },
    ]);

    expect(users[0]).toEqual({
      id: "user-2",
      email: null,
      displayName: "María Taller",
      createdAt: "2026-08-03T00:00:00.000Z",
      shops: [],
    });
    expect(users[1]?.shops[0]?.products).toEqual([]);
  });

  it("ignores incomplete child entities and unsupported product statuses", () => {
    const users = mapAdminMarketplaceUsers([
      base,
      { ...base, shop_slug: null, product_id: 22 },
      { ...base, product_id: 23, product_status: "expired" },
      { ...base, product_id: 24, product_updated_at: null },
    ]);

    expect(users[0]?.shops).toHaveLength(1);
    expect(users[0]?.shops[0]?.products.map((product) => product.id)).toEqual([
      20,
    ]);
  });

  it("keeps first-seen user and nested shop order", () => {
    const second = {
      ...base,
      user_id: "user-2",
      email: "second@test.local",
      shop_id: 11,
      shop_name: "Segundo Taller",
      shop_slug: "segundo-taller",
    };
    const secondUserFirstShop = {
      ...second,
      shop_id: 12,
      shop_name: "Primer Taller Visto",
      shop_slug: "primer-taller-visto",
    };

    const users = mapAdminMarketplaceUsers([secondUserFirstShop, second, base]);

    expect(users.map((user) => user.id)).toEqual(["user-2", "user-1"]);
    expect(users[0]?.shops.map((shop) => shop.id)).toEqual([12, 11]);
  });
});
