import { describe, expect, it } from "vitest";

import {
  isMediaContentType,
  keyExtension,
  keyOwner,
  mediaExtension,
  productImageKey,
  shopImageKey,
} from "@/lib/media/keys";

describe("media keys", () => {
  it("scopes a product image under its owner", () => {
    // No product id: the browser uploads before the product row exists, and
    // which product an object belongs to is what the database row says.
    expect(productImageKey("seller-1", "image/jpeg", "abc")).toBe("products/seller-1/abc.jpg");
  });

  it("reports the owner a key is scoped to", () => {
    expect(keyOwner("products/seller-1/abc.jpg")).toBe("seller-1");
    expect(keyOwner("shops/seller-1/abc.jpg")).toBe("seller-1");
    expect(keyOwner("seller-1/products/abc.jpg")).toBeNull();
    expect(keyOwner("abc.jpg")).toBeNull();
  });

  it("reports a key's extension", () => {
    expect(keyExtension("products/seller-1/abc.webp")).toBe("webp");
    expect(keyExtension("sin-extension")).toBeNull();
  });

  it("scopes a shop image under its owner", () => {
    expect(shopImageKey("seller-1", "image/png", "abc")).toBe("shops/seller-1/abc.png");
  });

  it("takes the extension from the allowlist, never from the uploaded name", () => {
    expect(mediaExtension("image/webp")).toBe("webp");
    expect(productImageKey("seller-1", "image/webp", "abc").endsWith(".webp")).toBe(true);
  });

  it("rejects a content type outside the allowlist", () => {
    expect(isMediaContentType("image/gif")).toBe(false);
    expect(isMediaContentType("image/jpeg")).toBe(true);
  });

  it("gives every image its own key", () => {
    expect(productImageKey("seller-1", "image/jpeg")).not.toBe(
      productImageKey("seller-1", "image/jpeg"),
    );
  });
});
