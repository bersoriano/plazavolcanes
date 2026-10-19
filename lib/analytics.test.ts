import { afterEach, describe, expect, it, vi } from "vitest";

import { sanitizeAnalyticsEvent, trackNavigation, trackSellerSubmission } from "@/lib/analytics";

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture } }));

function clickNavigation(event: MouseEvent) {
  event.preventDefault();
  trackNavigation(event);
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("analytics privacy", () => {
  it("removes query strings, fragments and person updates before sending", () => {
    const result = sanitizeAnalyticsEvent({
      uuid: "00000000-0000-4000-8000-000000000001",
      event: "$pageview",
      $set: { email: "private@example.com" },
      $set_once: { $initial_current_url: "https://example.com/?token=secret" },
      properties: {
        token: "project-token",
        distinct_id: "anonymous-visitor",
        $current_url: "https://plazavolcanes.com/auth/confirm?token_hash=secret#access_token=secret",
        $referrer: "https://example.com/?email=private@example.com#secret",
        $set: { email: "private@example.com" },
        $set_once: { $initial_current_url: "https://example.com/?token=secret" },
        $title: "Private account name",
        title: "Private account name",
        ph_keyword: "private@example.com",
        $session_entry_ph_keyword: "private@example.com",
        $session_entry_utm_term: "private@example.com",
        unexpected_future_sdk_field: "private@example.com",
      },
    });

    expect(result?.properties).toEqual({
      token: "project-token",
      distinct_id: "anonymous-visitor",
      $current_url: "https://plazavolcanes.com/auth/confirm",
      $referrer: "https://example.com/",
    });
    expect(result).not.toHaveProperty("$set");
    expect(result).not.toHaveProperty("$set_once");
  });

  it("also cleans session URLs without changing attribution domains", () => {
    const result = sanitizeAnalyticsEvent({ uuid: "00000000-0000-4000-8000-000000000002", event: "$pageleave", properties: {
      $session_entry_url: "https://plazavolcanes.com/registro?vender=1&email=private",
      $prev_pageview_pathname: "/vender?token=secret#secret",
      $referring_domain: "example.com",
      $referrer: "$direct",
    } });

    expect(result?.properties).toEqual({
      $session_entry_url: "https://plazavolcanes.com/registro",
      $prev_pageview_pathname: "/vender",
      $referring_domain: "example.com",
      $referrer: "$direct",
    });
  });

  it("drops events outside the configured analytics scope", () => {
    expect(sanitizeAnalyticsEvent({ uuid: "00000000-0000-4000-8000-000000000003", event: "$autocapture", properties: { text: "private" } })).toBeNull();
  });
});

describe("landing navigation", () => {
  it("captures nested link clicks with safe destinations and CTA placement", () => {
    document.body.innerHTML = '<section id="hero"><a href="/registro?vender=1&desde=hero&email=private"><span>Start</span></a></section>';
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.querySelector("span")!.addEventListener("click", clickNavigation);
    document.querySelector("span")!.dispatchEvent(click);

    expect(capture).toHaveBeenCalledWith("navigation_clicked", {
      source_path: "/", destination_path: "/registro", source_section: "hero", seller_intent: true,
    });
  });

  it("records in-page section navigation separately", () => {
    window.history.replaceState(null, "", "/vender");
    document.body.innerHTML = '<a href="#beneficios"><span>Benefits</span></a><section id="beneficios"></section>';
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.querySelector("span")!.addEventListener("click", clickNavigation);
    document.querySelector("span")!.dispatchEvent(click);

    expect(capture).toHaveBeenCalledWith("navigation_clicked", expect.objectContaining({
      source_path: "/vender", destination_path: "/vender", target_section: "beneficios",
    }));
  });

  it.each(["/panel", "/mensajes/123"])("does not capture private link content on %s", (path) => {
    window.history.replaceState(null, "", path);
    document.body.innerHTML = '<a href="/panel/cuenta">Private</a>';
    const link = document.querySelector("a")!;
    link.addEventListener("click", clickNavigation);
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("seller submissions", () => {
  it("records only the tagged event and never reads form fields", () => {
    document.body.innerHTML = '<form data-analytics-event="seller_signup_submitted"><input name="email" value="private@example.com"><input name="password" value="secret"></form>';
    const form = document.querySelector("form")!;
    form.addEventListener("submit", trackSellerSubmission);
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(capture).toHaveBeenCalledWith("seller_signup_submitted");
  });

  it("ignores untagged forms and unknown event names", () => {
    for (const tag of ["", 'data-analytics-event="send_private_data"']) {
      document.body.innerHTML = `<form ${tag}></form>`;
      const form = document.querySelector("form")!;
      form.addEventListener("submit", trackSellerSubmission);
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
    expect(capture).not.toHaveBeenCalled();
  });
});
