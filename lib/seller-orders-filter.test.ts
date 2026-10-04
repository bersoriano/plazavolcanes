import { describe, expect, it } from "vitest";

import {
  CLOSED_PAGE_SIZE,
  describeOrderItems,
  orderSearchTerm,
  parseSellerOrdersFilter,
  sellerOrdersHref,
} from "@/lib/seller-orders-filter";

describe("parseSellerOrdersFilter", () => {
  it("shows every order, the first page of history, with nothing else applied", () => {
    expect(parseSellerOrdersFilter({})).toEqual({ tab: "todos", search: "", shopId: null, closedLimit: CLOSED_PAGE_SIZE });
  });

  it("reads the tab, search, shop and history depth from the address", () => {
    expect(parseSellerOrdersFilter({ estado: "cerrados", buscar: "  florero ", tienda: "6", cerrados: "40" })).toEqual({
      tab: "cerrados",
      search: "florero",
      shopId: 6,
      closedLimit: 40,
    });
  });

  it("ignores values a hand-edited address cannot mean", () => {
    expect(parseSellerOrdersFilter({ estado: "borrados", tienda: "-3", cerrados: "abc" })).toEqual({
      tab: "todos",
      search: "",
      shopId: null,
      closedLimit: CLOSED_PAGE_SIZE,
    });
    expect(parseSellerOrdersFilter({ tienda: ["6", "7"] }).shopId).toBeNull();
  });

  it("keeps history in whole pages and within reach of one read", () => {
    expect(parseSellerOrdersFilter({ cerrados: "33" }).closedLimit).toBe(40);
    expect(parseSellerOrdersFilter({ cerrados: "5" }).closedLimit).toBe(20);
    expect(parseSellerOrdersFilter({ cerrados: "100000" }).closedLimit).toBe(500);
  });

  it("caps a pasted search at a sensible length", () => {
    expect(parseSellerOrdersFilter({ buscar: "x".repeat(300) }).search).toHaveLength(80);
  });
});

describe("orderSearchTerm", () => {
  it("reads a number, with or without #, as an order number", () => {
    expect(orderSearchTerm("#12")).toEqual({ kind: "order", id: 12 });
    expect(orderSearchTerm("12")).toEqual({ kind: "order", id: 12 });
  });

  it("reads anything else as part of a product name, with wildcards taken literally", () => {
    expect(orderSearchTerm("Flor")).toEqual({ kind: "product", pattern: "%Flor%" });
    expect(orderSearchTerm("50%_off\\")).toEqual({ kind: "product", pattern: "%50\\%\\_off\\\\%" });
  });

  it("finds nothing to search for in an empty box", () => {
    expect(orderSearchTerm("")).toBeNull();
    expect(orderSearchTerm("#")).toBeNull();
  });

  it("treats a number too large to be an order as text", () => {
    expect(orderSearchTerm("99999999999999999999")).toEqual({ kind: "product", pattern: "%99999999999999999999%" });
  });
});

describe("sellerOrdersHref", () => {
  it("leaves defaults out of the address", () => {
    expect(sellerOrdersHref({ tab: "todos", search: "", shopId: null, closedLimit: CLOSED_PAGE_SIZE })).toBe("/panel/pedidos");
  });

  it("carries every choice that differs from the default", () => {
    expect(sellerOrdersHref({ tab: "cerrados", search: "flor ero", shopId: 6, closedLimit: 40 })).toBe(
      "/panel/pedidos?estado=cerrados&buscar=flor+ero&tienda=6&cerrados=40",
    );
  });
});

describe("describeOrderItems", () => {
  it("names the first product and how many units", () => {
    expect(describeOrderItems([{ product_name: "Florero", quantity: 2 }])).toBe("Florero ×2");
    expect(describeOrderItems([{ product_name: "Florero", quantity: 1 }])).toBe("Florero");
  });

  it("counts the rest of an order with several products", () => {
    expect(describeOrderItems([{ product_name: "Florero", quantity: 2 }, { product_name: "Jarra", quantity: 1 }])).toBe(
      "Florero ×2 y 1 producto más",
    );
    expect(
      describeOrderItems([
        { product_name: "Florero", quantity: 1 },
        { product_name: "Jarra", quantity: 1 },
        { product_name: "Taza", quantity: 3 },
      ]),
    ).toBe("Florero y 2 productos más");
  });

  it("still says something for an order whose items could not be read", () => {
    expect(describeOrderItems([])).toBe("Productos no disponibles");
  });
});
