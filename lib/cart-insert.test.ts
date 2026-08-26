import { describe, expect, it, vi } from "vitest";

import { insertCartItem } from "@/lib/cart-insert";

function clientWith({
  product,
  rpcError,
}: {
  product: { shop_id: number } | null;
  rpcError?: { message: string };
}) {
  const rpc = vi.fn().mockResolvedValue({ error: rpcError ?? null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: product });
  const eq = vi.fn(() => ({ eq, maybeSingle }));
  const from = vi.fn(() => ({ select: () => ({ eq, maybeSingle }) }));

  return { client: { from, rpc } as never, rpc };
}

describe("insertCartItem", () => {
  it("adds the product and names the cart it belongs to", async () => {
    const { client, rpc } = clientWith({ product: { shop_id: 4 } });

    const result = await insertCartItem(client, 12, 3);

    expect(result).toEqual({ status: "added", shopId: 4 });
    expect(rpc).toHaveBeenCalledWith("add_cart_item", { p_product_id: 12, p_quantity: 3 });
  });

  it("reports an unpublished or deleted product as unavailable", async () => {
    const { client, rpc } = clientWith({ product: null });

    const result = await insertCartItem(client, 12, 3);

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
