"use client";

import { useEffect } from "react";

import { analyticsEnabled, track } from "@/lib/analytics.client";

const MILESTONES = [25, 50, 75, 100];

/**
 * read_progress for the element marked `data-read-progress`: how much of it has
 * entered the window, at 25/50/75/100 %, once each. Measured only as the
 * reader scrolls, so opening a post is not reading it. Give it a `key` per
 * document (the post's slug) so the next post starts from zero.
 */
export function ReadProgress({ contentType = "article" }: { contentType?: "article" | "page" }) {
  useEffect(() => {
    if (!analyticsEnabled()) return;
    const target = document.querySelector<HTMLElement>("[data-read-progress]");
    if (!target) return;

    const sent = new Set<number>();
    let frame = 0;
    function measure() {
      frame = 0;
      const { top, height } = target!.getBoundingClientRect();
      if (height <= 0) return;
      const percent = ((window.innerHeight - top) / height) * 100;
      for (const milestone of MILESTONES) {
        if (percent < milestone || sent.has(milestone)) continue;
        sent.add(milestone);
        track("read_progress", { percent: milestone, content_type: contentType });
      }
      if (sent.size === MILESTONES.length) window.removeEventListener("scroll", onScroll);
    }
    // One measurement per frame at most.
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [contentType]);

  return null;
}
