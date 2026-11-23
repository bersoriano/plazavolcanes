"use client";

/**
 * Mount once in the root layout, inside <body>. Copied from the
 * landing-page-ga skill (assets/page-analytics.tsx); only the page grouping is
 * this site's (lib/analytics-pages.ts).
 *
 * - One page_view per pathname (initial load included).
 * - section_view once per section per page view, for [data-analytics-section].
 * - cta_click for any click inside [data-cta]; no per-button handlers needed.
 *
 * Markup contract:
 *   <section data-analytics-section="pricing">…</section>
 *   <a href="https://wa.me/…" data-cta="whatsapp" data-cta-location="hero">…</a>
 * cta_location falls back to the nearest data-analytics-section, then header/footer/nav.
 */
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { analyticsEnabled, track, trackPageView } from "@/lib/analytics.client";
import { analyticsPageParams as pageParams } from "@/lib/analytics-pages";

export function PageAnalytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!analyticsEnabled()) return;
    // Refs survive React Strict Mode's double effect, so dev sends one view too.
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      trackPageView(pageParams(pathname));
    }

    const seen = new Set<string>();
    const observed = new WeakSet<Element>();
    const sections = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.analyticsSection;
        if (!id || seen.has(id) || !entry.isIntersecting) continue;
        // Tall sections never reach a high ratio: also accept half a screen visible.
        if (entry.intersectionRatio >= 0.25 || entry.intersectionRect.height >= window.innerHeight * 0.5) {
          seen.add(id);
          track("section_view", { section_id: id });
        }
      }
      // Fine low thresholds: a section many screens tall still gets a callback at half a screen.
    }, { threshold: [0, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5] });
    function observeNew() {
      document.querySelectorAll("[data-analytics-section]").forEach((element) => {
        if (!observed.has(element)) { observed.add(element); sections.observe(element); }
      });
    }
    // Streamed or client-rendered sections can appear after this effect.
    // One scan per frame at most: animated pages mutate the DOM constantly.
    let scan = 0;
    const mutations = new MutationObserver(() => {
      if (!scan) scan = requestAnimationFrame(() => { scan = 0; observeNew(); });
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    observeNew();

    function click(event: MouseEvent) {
      if (event.type === "auxclick" && event.button !== 1) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-cta]") : null;
      if (!target) return;
      const area = target.closest<HTMLElement>("[data-cta-location], [data-analytics-section], header, footer, nav");
      const href = target instanceof HTMLAnchorElement ? target.href : "";
      let link_domain: string | undefined;
      try {
        const url = new URL(href);
        if (/^https?:$/.test(url.protocol) && url.origin !== window.location.origin) link_domain = url.hostname;
      } catch { /* empty or not a URL */ }
      track("cta_click", {
        cta_type: target.dataset.cta,
        cta_location: area?.dataset.ctaLocation || area?.dataset.analyticsSection || area?.tagName.toLowerCase() || "page",
        link_domain,
      });
    }
    document.addEventListener("click", click, true);
    document.addEventListener("auxclick", click, true);

    return () => {
      sections.disconnect();
      mutations.disconnect();
      if (scan) cancelAnimationFrame(scan);
      document.removeEventListener("click", click, true);
      document.removeEventListener("auxclick", click, true);
    };
  }, [pathname]);

  return null;
}
