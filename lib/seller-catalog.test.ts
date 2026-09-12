import { describe, expect, it } from "vitest";

import { organizeCatalog, parseCatalogTab } from "@/lib/seller-catalog";

const FAR_FUTURE = "2099-01-01T00:00:00.000Z";
const LONG_AGO = "2020-01-01T00:00:00.000Z";

const APPROVED_SHOP = {
  is_publishing_approved: true,
  publishing_reviewed_at: "2026-08-29T00:00:00.000Z",
};

function listing(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Taza de barro",
    status: "published" as const,
    expires_at: FAR_FUTURE,
    is_admin_enabled: true,
    ...overrides,
  };
}

describe("parseCatalogTab", () => {
  it("keeps a tab the catalogue actually offers", () => {
    expect(parseCatalogTab("vencidos")).toBe("vencidos");
  });

  it("falls back to every listing when the query string is junk", () => {
    // A hand-edited URL must not empty the catalogue: a seller who lands on
    // ?estado=nonsense should still see their products.
    expect(parseCatalogTab("nonsense")).toBe("todos");
    expect(parseCatalogTab(undefined)).toBe("todos");
    expect(parseCatalogTab(["publicados", "borradores"])).toBe("todos");
  });
});

describe("catalogue counts", () => {
  it("counts a live listing as published", () => {
    const { counts } = organizeCatalog([listing()], APPROVED_SHOP, {});

    expect(counts.publicados).toBe(1);
    expect(counts.todos).toBe(1);
  });

  it("counts a published row whose date has passed as expired", () => {
    // The status column still says "published" long after the date runs out.
    // Filtering on it would file this row under Publicados and the seller
    // would never find the listing that quietly stopped selling.
    const { counts } = organizeCatalog(
      [listing({ expires_at: LONG_AGO })],
      APPROVED_SHOP,
      {},
    );

    expect(counts.vencidos).toBe(1);
    expect(counts.publicados).toBe(0);
  });

  it("counts a published row disabled by administration as blocked", () => {
    const { counts } = organizeCatalog(
      [listing({ is_admin_enabled: false })],
      APPROVED_SHOP,
      {},
    );

    expect(counts.bloqueados).toBe(1);
    expect(counts.publicados).toBe(0);
  });

  it("counts a draft as a draft", () => {
    const { counts } = organizeCatalog(
      [listing({ status: "draft" })],
      APPROVED_SHOP,
      {},
    );

    expect(counts.borradores).toBe(1);
  });

  it("blocks a live listing while the shop waits for approval", () => {
    const { counts } = organizeCatalog(
      [listing()],
      { is_publishing_approved: false, publishing_reviewed_at: null },
      {},
    );

    expect(counts.bloqueados).toBe(1);
    expect(counts.publicados).toBe(0);
  });

  it("leaves a draft in drafts even while the shop waits for approval", () => {
    // The seller turned this one off themselves, and approval will not turn it
    // back on. Filing it under Bloqueados would blame administration for the
    // seller's own switch and hide the row from the tab they go to to flip it.
    const { counts } = organizeCatalog(
      [listing({ status: "draft" })],
      { is_publishing_approved: false, publishing_reviewed_at: null },
      {},
    );

    expect(counts.borradores).toBe(1);
    expect(counts.bloqueados).toBe(0);
  });
});

describe("catalogue filtering", () => {
  const catalogue = [
    listing({ id: 1, name: "Taza de barro" }),
    listing({ id: 2, name: "Jarra negra", status: "draft" }),
    listing({ id: 3, name: "Molcajete", expires_at: LONG_AGO }),
  ];

  it("shows every listing on the default tab", () => {
    const { visible } = organizeCatalog(catalogue, APPROVED_SHOP, {});

    expect(visible.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it("narrows the list to the chosen tab", () => {
    const { visible } = organizeCatalog(catalogue, APPROVED_SHOP, { tab: "borradores" });

    expect(visible.map((item) => item.id)).toEqual([2]);
  });

  it("keeps the counts whole while a tab narrows the list", () => {
    // The tabs have to keep announcing what is behind them, so the counts are
    // taken before the filter runs, never from the rows left on screen.
    const { counts, visible } = organizeCatalog(catalogue, APPROVED_SHOP, { tab: "borradores" });

    expect(visible).toHaveLength(1);
    expect(counts.todos).toBe(3);
    expect(counts.publicados).toBe(1);
    expect(counts.vencidos).toBe(1);
  });

  it("finds a listing typed without its accents", () => {
    // Sellers search from phone keyboards; "molcajete" must reach "Molcajete"
    // and "jarra" must reach a name the seller wrote with an accent.
    const { visible } = organizeCatalog(
      [listing({ id: 7, name: "Café de olla" })],
      APPROVED_SHOP,
      { search: "cafe" },
    );

    expect(visible.map((item) => item.id)).toEqual([7]);
  });

  it("matches a fragment from the middle of a name", () => {
    const { visible } = organizeCatalog(catalogue, APPROVED_SHOP, { search: "barro" });

    expect(visible.map((item) => item.id)).toEqual([1]);
  });

  it("applies the search inside the chosen tab", () => {
    const { visible } = organizeCatalog(catalogue, APPROVED_SHOP, {
      tab: "publicados",
      search: "jarra",
    });

    expect(visible).toEqual([]);
  });

  it("ignores a search of nothing but spaces", () => {
    const { visible } = organizeCatalog(catalogue, APPROVED_SHOP, { search: "   " });

    expect(visible).toHaveLength(3);
  });
});
