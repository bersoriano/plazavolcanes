import type { PostHogConfig } from "posthog-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { init, capture } = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { init, capture } }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
});

afterEach(async () => {
  const { trackNavigation, trackSellerSubmission } = await import("./lib/analytics");
  document.removeEventListener("click", trackNavigation);
  document.removeEventListener("submit", trackSellerSubmission, true);
  document.body.innerHTML = "";
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function submitSellerForm() {
  document.body.innerHTML = '<form data-analytics-event="seller_shop_submitted"></form>';
  document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true }));
}

describe("PostHog startup", () => {
  it.each([
    ["", "https://us.i.posthog.com"],
    ["phc_test", ""],
    ["   ", "https://us.i.posthog.com"],
  ])("stays inert without both settings (%s, %s)", async (token, host) => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", token);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", host);
    await import("./instrumentation-client");
    submitSellerForm();
    expect(init).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it("enables tracking with explicit privacy limits", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", " phc_test ");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", " https://eu.i.posthog.com ");
    await import("./instrumentation-client");
    expect(init).toHaveBeenCalledWith("phc_test", expect.objectContaining({
      api_host: "https://eu.i.posthog.com",
      capture_pageview: "history_change",
      disable_session_recording: true,
      autocapture: false,
      person_profiles: "never",
      respect_dnt: true,
    }));
    const config = init.mock.calls[0][1] as PostHogConfig;
    expect(config.get_current_url?.("https://example.com/auth/confirm?token=private#secret"))
      .toBe("https://example.com/auth/confirm");
    expect(config.before_send).toBeTypeOf("function");
    submitSellerForm();
    expect(capture).toHaveBeenCalledExactlyOnceWith("seller_shop_submitted");
  });

  it("leaves the application usable if initialization fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
    init.mockImplementationOnce(() => { throw new Error("SDK unavailable"); });
    await expect(import("./instrumentation-client")).resolves.toBeDefined();
    submitSellerForm();
    expect(capture).not.toHaveBeenCalled();
  });
});
