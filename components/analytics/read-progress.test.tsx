import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { analytics } = vi.hoisted(() => ({ analytics: { enabled: vi.fn(() => true), track: vi.fn() } }));
vi.mock("@/lib/analytics.client", () => ({ analyticsEnabled: analytics.enabled, track: analytics.track }));

import { ReadProgress } from "@/components/analytics/read-progress";

let articleTop = 0;

function renderArticle() {
  render(
    <>
      <article data-read-progress>Texto</article>
      <ReadProgress />
    </>,
  );
  const article = document.querySelector("article")!;
  // A 2000px article in an 800px window; the test moves its top as if scrolling.
  vi.spyOn(article, "getBoundingClientRect").mockImplementation(() => ({ top: articleTop, height: 2000 }) as DOMRect);
}

let frames: FrameRequestCallback[] = [];

/** Scrolls, then runs the frame the component asked for, as the browser would. */
function scrollTo(top: number) {
  articleTop = top;
  window.dispatchEvent(new Event("scroll"));
  const pending = frames;
  frames = [];
  for (const callback of pending) callback(0);
}

beforeEach(() => {
  articleTop = 100;
  analytics.enabled.mockReturnValue(true);
  vi.stubGlobal("innerHeight", 800);
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ReadProgress", () => {
  it("reports each depth milestone of the article once, only as the reader scrolls", () => {
    renderArticle();
    expect(analytics.track).not.toHaveBeenCalled();

    scrollTo(-300); // (800 + 300) / 2000 = 55% has entered the window
    scrollTo(-300);
    scrollTo(-1300); // 105%: the end is in view

    expect(analytics.track.mock.calls).toEqual([25, 50, 75, 100].map((percent) => ["read_progress", { percent, content_type: "article" }]));
  });

  it("stays quiet while analytics is off", () => {
    analytics.enabled.mockReturnValue(false);
    renderArticle();
    scrollTo(-1300);

    expect(analytics.track).not.toHaveBeenCalled();
  });
});
