"use client";

import { useEffect } from "react";

import { recordProductView } from "@/lib/actions/product-views";

/**
 * Counts the visit once the page is on screen, so crawlers and link
 * prefetches that never run scripts are left out. One count per product per
 * tab session.
 */
export function ProductViewBeacon({ productId }: { productId: number }) {
  useEffect(() => {
    const key = `visto:${productId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Without storage, count every visit.
    }
    void recordProductView(productId);
  }, [productId]);

  return null;
}
