import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/llms.txt/route";
import { FOUNDER_LISTING_LIMIT, FOUNDER_MIN_LIVE_ITEMS, FOUNDERS_CAP } from "@/lib/launch";
import { llmsText } from "@/lib/seo/llms-text";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("llms.txt", () => {
  it("links every page on the configured domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");

    const text = llmsText();

    expect(text.startsWith("# Plaza Volcanes\n")).toBe(true);
    for (const path of ["/vender", "/como-comprar", "/explorar", "/registro?vender=1"]) {
      expect(text).toContain(`(https://plazavolcanes.com${path})`);
    }
  });

  it("states the founders offer with the launch numbers", () => {
    const text = llmsText();

    expect(text).toContain(`Las primeras ${FOUNDERS_CAP} tiendas que publiquen ${FOUNDER_MIN_LIVE_ITEMS} productos`);
    expect(text).toContain(`${FOUNDER_LISTING_LIMIT} productos, insignia fundadora`);
  });

  it("is served as plain text", async () => {
    const response = GET();

    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe(llmsText());
  });
});
