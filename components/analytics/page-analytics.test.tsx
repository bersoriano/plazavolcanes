import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { analytics, navigation } = vi.hoisted(() => ({
  analytics: { enabled: vi.fn(() => true), track: vi.fn(), trackPageView: vi.fn() },
  navigation: { pathname: "/" },
}));

vi.mock("@/lib/analytics.client", () => ({
  analyticsEnabled: analytics.enabled,
  track: analytics.track,
  trackPageView: analytics.trackPageView,
}));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { PageAnalytics } from "@/components/analytics/page-analytics";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let reportVisibility: Callback;

beforeEach(() => {
  navigation.pathname = "/";
  analytics.enabled.mockReturnValue(true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: Callback) { reportVisibility = callback; }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("PageAnalytics", () => {
  it("sends one page view per path with this site's page grouping", () => {
    const { rerender } = render(<PageAnalytics />);
    rerender(<PageAnalytics />);
    navigation.pathname = "/tiendas/alfareria-puebla";
    rerender(<PageAnalytics />);

    expect(analytics.trackPageView.mock.calls).toEqual([
      [{ page_type: "landing" }],
      [{ page_type: "shop" }],
    ]);
  });

  it("reports a marked call to action with the section it sits in", () => {
    render(
      <section data-analytics-section="hero">
        <a data-cta="signup" href="/registro?vender=1">Crear mi tienda</a>
      </section>,
    );
    render(<PageAnalytics />);
    fireEvent.click(document.querySelector("a")!);

    expect(analytics.track).toHaveBeenCalledWith("cta_click", { cta_type: "signup", cta_location: "hero", link_domain: undefined });
  });

  it("counts a section once it is a quarter visible", () => {
    render(<section data-analytics-section="pasos">Pasos</section>);
    render(<PageAnalytics />);
    const target = document.querySelector("section")!;
    const entry = { target, isIntersecting: true, intersectionRatio: 0.3, intersectionRect: { height: 10 } as DOMRectReadOnly };
    reportVisibility([entry]);
    reportVisibility([entry]);

    expect(analytics.track.mock.calls).toEqual([["section_view", { section_id: "pasos" }]]);
  });

  it("does nothing while analytics is off", () => {
    analytics.enabled.mockReturnValue(false);
    render(<a data-cta="login" href="/ingresar">Ingresar</a>);
    render(<PageAnalytics />);
    fireEvent.click(document.querySelector("a")!);

    expect(analytics.trackPageView).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalled();
  });
});
