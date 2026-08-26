import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "@/app/robots";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots", () => {
  it("points crawlers at the sitemap on the configured domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");

    const result = robots();

    expect(result.sitemap).toBe("https://plazavolcanes.com/sitemap.xml");
    expect(result.host).toBe("https://plazavolcanes.com");
  });

  it("blocks the routes that require a session", () => {
    const rules = robots().rules;
    const disallow = Array.isArray(rules) ? [] : [rules.disallow].flat();

    expect(disallow).toEqual(
      expect.arrayContaining(["/panel/", "/admin/", "/compras/", "/mensajes/", "/carrito/", "/auth/", "/api/"]),
    );
  });
});
