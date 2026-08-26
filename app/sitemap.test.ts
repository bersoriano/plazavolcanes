import { afterEach, describe, expect, it, vi } from "vitest";

import sitemap from "@/app/sitemap";
import { getSitemapCatalog } from "@/lib/queries/sitemap.server";
import { MEXICO_ADMINISTRATIVE_AREAS } from "@/lib/shop-location";

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
    expect(urls).toHaveLength(3 + MEXICO_ADMINISTRATIVE_AREAS.length);
  });

  it("keeps signed-in areas out of the index", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");
    vi.mocked(getSitemapCatalog).mockResolvedValue({ shops: [], products: [] });

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.includes("/panel"))).toBe(false);
    expect(urls.some((url) => url.includes("/mensajes"))).toBe(false);
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
});
