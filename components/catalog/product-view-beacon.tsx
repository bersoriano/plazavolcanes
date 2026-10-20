"use client";

import { useEffect, useMemo } from "react";

import { recordProductActivity } from "@/lib/actions/product-activity";
import { createProductTracker, type ProductActivity } from "@/lib/product-activity";

/**
 * Counts the visit once the page is on screen, so crawlers and link
 * prefetches that never run scripts are left out. One count per product per
 * tab session. CTA attempts share the same short-lived measurement session.
 */
export function ProductViewBeacon({ productId }: { productId: number }) {
  const track = useMemo(() => createProductTracker(productId, recordProductActivity), [productId]);
  useEffect(() => {
    void track("view");
    function collect(event: Event) {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("[data-product-cta]");
      if (!target?.closest(`[data-product-analytics="${productId}"]`)) return;
      // Form clicks include quantity inputs; collect only the actual submit.
      if (target.tagName === "FORM" && event.type !== "submit") return;
      const action = target.dataset.productCta;
      if (action === "question" || action === "purchase" || action === "share") void track(action as ProductActivity);
    }
    document.addEventListener("click", collect);
    document.addEventListener("submit", collect, true);
    return () => {
      document.removeEventListener("click", collect);
      document.removeEventListener("submit", collect, true);
    };
  }, [productId, track]);

  return null;
}
