import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsConfig } from "./lib/analytics.client";

const { initAnalytics } = vi.hoisted(() => ({ initAnalytics: vi.fn() }));
vi.mock("./lib/analytics.client", () => ({ initAnalytics }));

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

async function startup() {
  await import("./instrumentation-client");
  expect(initAnalytics).toHaveBeenCalledOnce();
  return initAnalytics.mock.calls[0][0] as AnalyticsConfig;
}

describe("analytics startup", () => {
  it("starts the shared core once, with the public-page allowlist", async () => {
    const { isPublicAnalyticsPath } = await import("./lib/analytics-pages");

    expect((await startup()).isTrackablePath).toBe(isPublicAnalyticsPath);
  });

  it("hands PostHog to the core as its only extra destination", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "/ingest");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_DEBUG", "");
    const { destinations = [] } = await startup();

    expect(destinations).toHaveLength(1);
    // Off the canonical host and without debug, PostHog stays out, like GA.
    expect(destinations[0]({ production: false })).toBeNull();
  });

  it("leaves PostHog out without a project token", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "/ingest");
    const { destinations = [] } = await startup();

    expect(destinations[0]({ production: true })).toBeNull();
  });
});
