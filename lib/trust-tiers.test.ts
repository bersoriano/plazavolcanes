import { describe, expect, it } from "vitest";

import { getTrustTierMarker } from "@/lib/trust-tiers";

describe("getTrustTierMarker", () => {
  it.each([
    ["standard", "Estándar", 15],
    ["reliable", "Confiable", 40],
    ["top_rated", "Mejor valorada", 100],
  ] as const)("formats %s using Spanish marketplace copy", (tier, label, limit) => {
    const marker = getTrustTierMarker(tier);
    expect(marker.label).toBe(label);
    expect(marker.listingLimit).toBe(limit);
    expect(marker.tooltip.length).toBeGreaterThan(20);
  });
});
