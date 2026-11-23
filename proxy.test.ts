// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));

const SITE = "https://plazavolcanes.com";

async function load(region?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_REGION", region ?? "");
  return import("./proxy");
}

function request(path: string, headers: Record<string, string> = {}) {
  // Concatenated, not resolved: "//host/" must stay a path on the site.
  return new NextRequest(`${SITE}${path}`, { headers });
}

beforeEach(() => {
  updateSession.mockResolvedValue(NextResponse.next());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("proxy", () => {
  it("sends PostHog calls to PostHog without the site's cookies or Referer, and skips the session refresh", async () => {
    const { proxy } = await load();
    const response = await proxy(request("/ingest/i/v0/e/?compression=gzip-js", {
      cookie: "sb-access-token=secret",
      referer: `${SITE}/registro?email=ana%40correo.com`,
      "user-agent": "UA",
    }));

    expect(response.headers.get("x-middleware-rewrite")).toBe("https://us.i.posthog.com/i/v0/e/?compression=gzip-js");
    expect(response.headers.get("x-middleware-request-cookie")).toBeNull();
    expect(response.headers.get("x-middleware-request-referer")).toBeNull();
    expect(response.headers.get("x-middleware-request-host")).toBe("us.i.posthog.com");
    expect(response.headers.get("x-middleware-request-user-agent")).toBe("UA");
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("follows the project's region and serves PostHog assets from the assets host", async () => {
    const { proxy } = await load("eu");

    expect((await proxy(request("/ingest/static/array.js"))).headers.get("x-middleware-rewrite")).toBe("https://eu-assets.i.posthog.com/static/array.js");
  });

  it("keeps redirecting site pages away from a trailing slash, query included", async () => {
    const { proxy } = await load();
    const response = await proxy(request("/vender/?desde=footer"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`${SITE}/vender?desde=footer`);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("never redirects off the site, whatever the path looks like", async () => {
    const { proxy } = await load();

    for (const path of ["//evil.example/", "//evil.example//", "///"]) {
      const location = new URL((await proxy(request(path))).headers.get("location")!);
      expect(location.origin, path).toBe(SITE);
    }
  });

  it("hands every other request to the Supabase session refresh", async () => {
    const { proxy } = await load();
    const incoming = request("/");
    await proxy(incoming);

    expect(updateSession).toHaveBeenCalledExactlyOnceWith(incoming);
  });

  it("matches /ingest explicitly, next to the existing page pattern", async () => {
    const { config } = await load();

    expect(config.matcher).toEqual([
      "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      "/ingest/:path*",
    ]);
  });
});
