import { describe, expect, it } from "vitest";

import { isMediaContentType, mediaExtension, productImageKey, shopImageKey } from "@/lib/media/keys";

describe("media keys", () => {
  it("scopes a product image under its owner and its product", () => {
    expect(productImageKey("seller-1", 42, "image/jpeg", "abc")).toBe(
      "products/seller-1/42/abc.jpg",
    );
  });

  it("scopes a shop image under its owner", () => {
    expect(shopImageKey("seller-1", "image/png", "abc")).toBe("shops/seller-1/abc.png");
  });

  it("takes the extension from the allowlist, never from the uploaded name", () => {
    expect(mediaExtension("image/webp")).toBe("webp");
    expect(productImageKey("seller-1", 1, "image/webp", "abc").endsWith(".webp")).toBe(true);
  });

  it("rejects a content type outside the allowlist", () => {
    expect(isMediaContentType("image/gif")).toBe(false);
    expect(isMediaContentType("image/jpeg")).toBe(true);
  });

  it("gives every image its own key", () => {
    expect(productImageKey("seller-1", 42, "image/jpeg")).not.toBe(
      productImageKey("seller-1", 42, "image/jpeg"),
    );
  });
});
