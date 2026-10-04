import { describe, expect, it } from "vitest";

import { cartLineStockNotice } from "@/lib/cart-stock";

describe("cartLineStockNotice", () => {
  it("says nothing while the shop has enough units", () => {
    expect(cartLineStockNotice(2, 2)).toBeNull();
    expect(cartLineStockNotice(1, 5)).toBeNull();
  });

  it("says the listing sold out when no units remain", () => {
    expect(cartLineStockNotice(1, 0)).toBe("Agotado");
  });

  it("says how many units remain when the cart asks for more", () => {
    expect(cartLineStockNotice(3, 2)).toBe("Solo quedan 2");
    expect(cartLineStockNotice(3, 1)).toBe("Solo queda 1");
  });
});
