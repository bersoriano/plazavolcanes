"use client";

import { useEffect } from "react";

import { analyticsEnabled, track } from "@/lib/analytics.client";

/**
 * select_content when a visitor opens a marked disclosure:
 *
 *   <details data-content-type="faq" data-content-id="comision">…</details>
 *
 * It listens for clicks on the summary (keyboard activation clicks too) rather
 * than `toggle`, which also fires for an item rendered open. Closing is not
 * reported. Mount once in the root layout.
 */
export function ContentAnalytics() {
  useEffect(() => {
    if (!analyticsEnabled()) return;

    function click(event: MouseEvent) {
      const summary = event.target instanceof Element ? event.target.closest("summary") : null;
      const details = summary?.parentElement;
      if (!(details instanceof HTMLDetailsElement) || details.open) return;
      const { contentId, contentType } = details.dataset;
      if (contentId) track("select_content", { content_type: contentType || "faq", content_id: contentId });
    }
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);

  return null;
}
