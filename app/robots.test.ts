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

  it("blocks the routes that require a session for every crawler", () => {
    const rules = [robots().rules].flat();

    expect(rules.length).toBeGreaterThan(1);
    for (const rule of rules) {
      expect([rule.disallow].flat()).toEqual(
        expect.arrayContaining(["/panel/", "/admin/", "/compras/", "/mensajes/", "/carrito/", "/auth/", "/api/"]),
      );
    }
  });

  it("welcomes search engines and the crawlers behind AI answers", () => {
    const rules = [robots().rules].flat();
    const named = rules.flatMap((rule) => [rule.userAgent].flat());

    expect(named).toEqual(
      expect.arrayContaining([
        "*",
        "OAI-SearchBot",
        "ChatGPT-User",
        "PerplexityBot",
        "Claude-SearchBot",
        "Claude-User",
        "Googlebot",
        "Bingbot",
      ]),
    );
    for (const rule of rules) expect(rule.allow).toBe("/");
  });
});
