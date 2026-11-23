import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { analytics } = vi.hoisted(() => ({ analytics: { enabled: vi.fn(() => true), track: vi.fn() } }));
vi.mock("@/lib/analytics.client", () => ({ analyticsEnabled: analytics.enabled, track: analytics.track }));

import { ContentAnalytics } from "@/components/analytics/content-analytics";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderFaq() {
  render(
    <>
      <details data-content-id="comision" data-content-type="faq" open>
        <summary>¿Cobran comisión?</summary>
      </details>
      <details data-content-id="pago" data-content-type="faq">
        <summary>¿Cómo recibo mi dinero?</summary>
      </details>
      <details>
        <summary>Sin marcar</summary>
      </details>
      <ContentAnalytics />
    </>,
  );
}

const summary = (text: string) => [...document.querySelectorAll("summary")].find((element) => element.textContent === text)!;

describe("ContentAnalytics", () => {
  it("reports a marked question the visitor opens, not one that starts open or is closed", () => {
    renderFaq();
    expect(analytics.track).not.toHaveBeenCalled();

    fireEvent.click(summary("¿Cómo recibo mi dinero?"));
    fireEvent.click(summary("¿Cobran comisión?"));
    fireEvent.click(summary("Sin marcar"));

    expect(analytics.track.mock.calls).toEqual([["select_content", { content_type: "faq", content_id: "pago" }]]);
  });
});
