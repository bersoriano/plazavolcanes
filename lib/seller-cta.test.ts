import { describe, expect, it } from "vitest";

import { sellerCtaHref, sellerViewer } from "@/lib/seller-cta";

describe("sellerViewer", () => {
  it("tells a visitor, a signed-in visitor without a store and an owner apart", () => {
    expect(sellerViewer(false, false)).toBe("signed-out");
    expect(sellerViewer(true, false)).toBe("no-shop");
    expect(sellerViewer(true, true)).toBe("owner");
  });
});

describe("sellerCtaHref", () => {
  it("sends a visitor to seller signup, marked with where they clicked", () => {
    expect(sellerCtaHref("signed-out", "hero")).toBe("/registro?vender=1&desde=hero");
    expect(sellerCtaHref("signed-out", "sticky")).toBe("/registro?vender=1&desde=sticky");
  });

  it("sends a signed-in visitor without a store straight to creating one", () => {
    expect(sellerCtaHref("no-shop", "final")).toBe("/panel/tiendas/nueva?desde=final");
  });

  it("sends an owner to their panel", () => {
    expect(sellerCtaHref("owner", "pasos")).toBe("/panel");
  });
});
