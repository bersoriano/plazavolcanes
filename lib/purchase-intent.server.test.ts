import { beforeEach, describe, expect, it, vi } from "vitest";

import { PURCHASE_INTENT_COOKIE, serializePurchaseIntent } from "@/lib/purchase-intent";

const store = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
const insertCartItem = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("@/lib/cart-insert", () => ({ insertCartItem }));

const { clearPurchaseIntent, readPurchaseIntent, resumePurchaseIntent, savePurchaseIntent } =
  await import("@/lib/purchase-intent.server");

const intent = { productId: 12, quantity: 3, productPath: "/productos/taza" };
const supabase = {} as never;

function cookieHolds(value: string | undefined) {
  store.get.mockReturnValue(value === undefined ? undefined : { value });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieHolds(undefined);
  insertCartItem.mockResolvedValue({ status: "added", shopId: 4 });
});

describe("the pending purchase cookie", () => {
  it("is written where the browser cannot read it", async () => {
    await savePurchaseIntent(intent);

    expect(store.set).toHaveBeenCalledWith(
      PURCHASE_INTENT_COOKIE,
      serializePurchaseIntent(intent),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });

  it("reads back what was stored", async () => {
    cookieHolds(serializePurchaseIntent(intent));

    expect(await readPurchaseIntent()).toEqual(intent);
  });

  it("reads nothing when a tampered value cannot be trusted", async () => {
    cookieHolds(JSON.stringify({ ...intent, productPath: "https://evil.example" }));

    expect(await readPurchaseIntent()).toBeNull();
  });

  it("is removed on demand", async () => {
    await clearPurchaseIntent();

    expect(store.delete).toHaveBeenCalledWith(PURCHASE_INTENT_COOKIE);
  });
});

describe("resumePurchaseIntent", () => {
  it("has nothing to do for an ordinary sign-in", async () => {
    expect(await resumePurchaseIntent(supabase)).toBeNull();
    expect(insertCartItem).not.toHaveBeenCalled();
  });

  it("adds the remembered product and points at that shop's cart", async () => {
    cookieHolds(serializePurchaseIntent(intent));

    const destination = await resumePurchaseIntent(supabase);

    expect(insertCartItem).toHaveBeenCalledWith(supabase, 12, 3);
    expect(destination).toBe("/carrito/4");
  });

  it("consumes the intent so a refresh cannot add the product twice", async () => {
    cookieHolds(serializePurchaseIntent(intent));

    await resumePurchaseIntent(supabase);

    expect(store.delete).toHaveBeenCalledWith(PURCHASE_INTENT_COOKIE);

    cookieHolds(undefined);
    insertCartItem.mockClear();

    expect(await resumePurchaseIntent(supabase)).toBeNull();
    expect(insertCartItem).not.toHaveBeenCalled();
  });

  it("sends the buyer back to the product when it is gone", async () => {
    cookieHolds(serializePurchaseIntent(intent));
    insertCartItem.mockResolvedValue({ status: "unavailable" });

    expect(await resumePurchaseIntent(supabase)).toBe("/productos/taza?compra=agotado");
  });

  it("sends the buyer back to the product when the database refuses", async () => {
    cookieHolds(serializePurchaseIntent(intent));
    insertCartItem.mockResolvedValue({ status: "error", message: "No pudimos agregar el producto." });

    expect(await resumePurchaseIntent(supabase)).toBe("/productos/taza?compra=error");
  });

  it("falls back to the catalogue when the intent remembered no product page", async () => {
    cookieHolds(JSON.stringify({ productId: 12, quantity: 3 }));
    insertCartItem.mockResolvedValue({ status: "unavailable" });

    expect(await resumePurchaseIntent(supabase)).toBe("/?compra=agotado");
  });
});
