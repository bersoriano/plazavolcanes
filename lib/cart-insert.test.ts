import { describe, expect, it, vi } from "vitest";

import { insertCartItem } from "@/lib/cart-insert";

function clientWith({
  product,
  rpcError,
}: {
  product: {
    shop_id: number;
    status?: string;
    is_admin_enabled?: boolean;
    expires_at?: string | null;
    shops?: { is_publishing_approved: boolean };
  } | null;
  rpcError?: { message: string };
}) {
  const rpc = vi.fn().mockResolvedValue({ error: rpcError ?? null });
  const candidate = product && {
    status: "published",
    is_admin_enabled: true,
    expires_at: "2026-09-01T00:00:00.000Z",
    shops: { is_publishing_approved: true },
    ...product,
  };
  const filters = new Map<string, unknown>();
  let requiresExpiry = false;
  const query = {
    eq: vi.fn(function (column: string, value: unknown) {
      filters.set(column, value);
      return query;
    }),
    not: vi.fn(function (column: string, operator: string, value: unknown) {
      requiresExpiry = column === "expires_at" && operator === "is" && value === null;
      return query;
    }),
    gt: vi.fn(function () {
      return query;
    }),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: candidate &&
        (!filters.has("status") || candidate.status === filters.get("status")) &&
        (!filters.has("is_admin_enabled") ||
          candidate.is_admin_enabled === filters.get("is_admin_enabled")) &&
        (!filters.has("shops.is_publishing_approved") ||
          candidate.shops.is_publishing_approved === filters.get("shops.is_publishing_approved")) &&
        (!requiresExpiry || candidate.expires_at !== null)
        ? candidate
        : null,
    })),
  };
  const from = vi.fn(() => ({ select: () => query }));

  return { client: { from, rpc } as never, rpc, eq: query.eq, not: query.not, gt: query.gt };
}

describe("insertCartItem", () => {
  it("adds the product and names the cart it belongs to", async () => {
    const { client, rpc, eq, not, gt } = clientWith({ product: { shop_id: 4 } });

    const result = await insertCartItem(client, 12, 3);

    expect(result).toEqual({ status: "added", shopId: 4 });
    expect(rpc).toHaveBeenCalledWith("add_cart_item", { p_product_id: 12, p_quantity: 3 });
    expect(eq).toHaveBeenCalledWith("is_admin_enabled", true);
    expect(eq).toHaveBeenCalledWith("shops.is_publishing_approved", true);
    expect(not).toHaveBeenCalledWith("expires_at", "is", null);
    expect(gt).toHaveBeenCalledWith("expires_at", expect.any(String));
  });

  it("reports an unpublished or deleted product as unavailable", async () => {
    const { client, rpc } = clientWith({ product: null });

    const result = await insertCartItem(client, 12, 3);

    expect(result).toEqual({ status: "unavailable" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["belongs to a pending shop", { is_admin_enabled: true, shops: { is_publishing_approved: false } }],
    ["is disabled by an admin", { is_admin_enabled: false, shops: { is_publishing_approved: true } }],
  ])("does not add a published product that %s", async (_reason, gate) => {
    const { client, rpc } = clientWith({ product: { shop_id: 4, ...gate } });

    const result = await insertCartItem(client, 12, 1);

    expect(result).toEqual({ status: "unavailable" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the database's own refusal along in Spanish", async () => {
    const { client } = clientWith({
      product: { shop_id: 4 },
      rpcError: { message: "No puedes comprar de tu propia tienda" },
    });

    const result = await insertCartItem(client, 12, 3);

    expect(result).toEqual({
      status: "error",
      message: "No puedes solicitar productos de tu propia tienda.",
    });
  });

  it("falls back to a general message for an unrecognised failure", async () => {
    const { client } = clientWith({ product: { shop_id: 4 }, rpcError: { message: "boom" } });

    const result = await insertCartItem(client, 12, 3);

    expect(result).toEqual({ status: "error", message: "No pudimos agregar el producto." });
  });
});
