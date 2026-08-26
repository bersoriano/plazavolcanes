import { describe, expect, it } from "vitest";

import { parsePurchaseIntent, serializePurchaseIntent } from "@/lib/purchase-intent";

const intent = { productId: 12, quantity: 3, productPath: "/productos/taza-de-barro" };

describe("purchase intent", () => {
  it("survives a round trip through the cookie value", () => {
    expect(parsePurchaseIntent(serializePurchaseIntent(intent))).toEqual(intent);
  });

  it("has nothing to resume when the cookie is absent or malformed", () => {
    expect(parsePurchaseIntent(undefined)).toBeNull();
    expect(parsePurchaseIntent("")).toBeNull();
    expect(parsePurchaseIntent("not json")).toBeNull();
    expect(parsePurchaseIntent("[]")).toBeNull();
  });

  it("rejects a product id that is not a positive integer", () => {
    expect(parsePurchaseIntent(JSON.stringify({ ...intent, productId: 0 }))).toBeNull();
    expect(parsePurchaseIntent(JSON.stringify({ ...intent, productId: 1.5 }))).toBeNull();
    expect(parsePurchaseIntent(JSON.stringify({ ...intent, productId: "12" }))).toBeNull();
  });

  it("rejects a quantity outside what the cart accepts", () => {
    expect(parsePurchaseIntent(JSON.stringify({ ...intent, quantity: 0 }))).toBeNull();
    expect(parsePurchaseIntent(JSON.stringify({ ...intent, quantity: 100 }))).toBeNull();
  });

  it("rejects a product path pointing off the site", () => {
    expect(
      parsePurchaseIntent(JSON.stringify({ ...intent, productPath: "https://evil.example" })),
    ).toBeNull();
    expect(parsePurchaseIntent(JSON.stringify({ ...intent, productPath: "//evil.example" }))).toBeNull();
  });

  it("keeps an intent that names no product page", () => {
    expect(parsePurchaseIntent(JSON.stringify({ productId: 12, quantity: 3 }))).toEqual({
      productId: 12,
      quantity: 3,
      productPath: null,
    });
  });
});
