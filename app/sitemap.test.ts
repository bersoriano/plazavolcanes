import { afterEach, describe, expect, it, vi } from "vitest";

import sitemap from "@/app/sitemap";
import { LEGAL_ROUTES } from "@/lib/legal/document-types";
import { getSitemapCatalog } from "@/lib/queries/sitemap.server";
import { MEXICO_ADMINISTRATIVE_AREAS } from "@/lib/shop-location";
import { buildSiteUrl } from "@/lib/site-url";

vi.mock("@/lib/queries/sitemap.server", () => ({ getSitemapCatalog: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("sitemap", () => {
  it("lists public pages on the configured domain", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");
    vi.mocked(getSitemapCatalog).mockResolvedValue({
      shops: [{ slug: "casa-niebla", updatedAt: "2026-08-01T00:00:00.000Z" }],
      products: [{ slug: "taza-de-barro", updatedAt: "2026-08-02T00:00:00.000Z" }],
    });

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://plazavolcanes.com/");
    expect(urls).toContain("https://plazavolcanes.com/tiendas/casa-niebla");
    expect(urls).toContain("https://plazavolcanes.com/productos/taza-de-barro");
    expect(urls).toContain("https://plazavolcanes.com/estado/jalisco");
    expect(urls).toHaveLength(3 + MEXICO_ADMINISTRATIVE_AREAS.length + LEGAL_ROUTES.length);
  });

  it("keeps signed-in areas out of the index", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");
    vi.mocked(getSitemapCatalog).mockResolvedValue({ shops: [], products: [] });

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.includes("/panel"))).toBe(false);
    expect(urls.some((url) => url.includes("/mensajes"))).toBe(false);
  });

  it("omits a published product URL when the shop approval gate filters it out", async () => {
    const pendingShopPublishedProduct = {
      slug: "taza-pendiente",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    const catalogDouble = (filters: { isAdminEnabled?: boolean; isShopApproved?: boolean }) => ({
      shops: [],
      products:
        filters.isAdminEnabled === true && filters.isShopApproved === true
          ? []
          : [pendingShopPublishedProduct],
    });
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");
    expect(catalogDouble({ isAdminEnabled: true }).products).toEqual([pendingShopPublishedProduct]);
    vi.mocked(getSitemapCatalog).mockResolvedValue(
      catalogDouble({ isAdminEnabled: true, isShopApproved: true }),
    );

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).not.toContain(
      `https://plazavolcanes.com/productos/${pendingShopPublishedProduct.slug}`,
    );
  });

  it("dates catalog entries from their last update", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");
    vi.mocked(getSitemapCatalog).mockResolvedValue({
      shops: [{ slug: "casa-niebla", updatedAt: "2026-08-01T00:00:00.000Z" }],
      products: [],
    });

    const shopEntry = (await sitemap()).find((entry) => entry.url.includes("/tiendas/"));

    expect(shopEntry?.lastModified).toEqual(new Date("2026-08-01T00:00:00.000Z"));
  });

  it("lists every legal route", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");
    vi.mocked(getSitemapCatalog).mockResolvedValue({ shops: [], products: [] });

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    for (const route of LEGAL_ROUTES) {
      expect(urls).toContain(buildSiteUrl(route.path));
    }
  });
});
