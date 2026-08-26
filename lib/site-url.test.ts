import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSiteUrl, getSiteUrl } from "@/lib/site-url";

describe("getSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to localhost when the variable is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("drops trailing slashes and surrounding spaces", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", " https://plazavolcanes.com/ ");

    expect(getSiteUrl()).toBe("https://plazavolcanes.com");
  });

  it("assumes https for a host given without a scheme", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "plazavolcanes.com");

    expect(getSiteUrl()).toBe("https://plazavolcanes.com");
  });

  it("keeps a base path", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com/tienda/");

    expect(getSiteUrl()).toBe("https://plazavolcanes.com/tienda");
  });

  it("falls back when the value cannot be parsed", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://");

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("joins paths with a single slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");

    expect(buildSiteUrl("/sitemap.xml")).toBe("https://plazavolcanes.com/sitemap.xml");
    expect(buildSiteUrl("auth/confirm")).toBe("https://plazavolcanes.com/auth/confirm");
  });
});
