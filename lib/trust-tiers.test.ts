import { describe, expect, it } from "vitest";

import { getTrustTierMarker } from "@/lib/trust-tiers";

describe("getTrustTierMarker", () => {
  it.each([
    ["standard", "Estándar"],
    ["reliable", "Confiable"],
    ["top_rated", "Mejor valorada"],
  ] as const)("formats %s using Spanish marketplace copy", (tier, label) => {
    const marker = getTrustTierMarker(tier);
    expect(marker.label).toBe(label);
    expect(marker.tooltip.length).toBeGreaterThan(20);
  });
});
