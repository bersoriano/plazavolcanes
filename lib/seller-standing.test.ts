import { describe, expect, it } from "vitest";

import type { PublicTrustMetrics, TrustMetricsResult } from "@/lib/public-trust";
import {
  hasMeasuredHistory,
  newSellerNote,
  publicReputationTier,
  summarizeSellingHistory,
} from "@/lib/seller-standing";

const blank: PublicTrustMetrics = {
  averageReplyTimeMinutes: null,
  responseRate: null,
  descriptionAccuracy: null,
  onTimeShippingRate: null,
  orderCompletionRate: null,
  disputeRate: null,
  totalOrders: 0,
  averageRating: null,
  reviewCount: 0,
  lastActiveDaysAgo: null,
  sellerActiveDaysAgo: null,
  evaluatedAt: "2026-09-01T00:00:00.000Z",
};

function ready(overrides: Partial<PublicTrustMetrics> = {}): TrustMetricsResult {
  return { status: "ready", metrics: { ...blank, ...overrides } };
}

describe("summarizeSellingHistory", () => {
  it("tells a failed read apart from an empty history", () => {
    const failed = summarizeSellingHistory({ status: "unavailable" });
    const empty = summarizeSellingHistory({ status: "pending" });

    expect(failed.state).toBe("unavailable");
    expect(failed.headline).not.toBe(empty.headline);
    expect(failed.detail).toMatch(/Vuelve a cargar/);
  });

  it("never calls a shop new because a read failed", () => {
    expect(summarizeSellingHistory({ status: "unavailable" }).headline).not.toMatch(/nuev/i);
  });

  it("says a shop with an evaluation but no sales is still without reviews", () => {
    const summary = summarizeSellingHistory(ready());

    expect(summary.state).toBe("empty");
    expect(summary.headline).toBe("aún sin reseñas");
  });

  it("reports the real counts once there are any", () => {
    const summary = summarizeSellingHistory(ready({ totalOrders: 12, reviewCount: 8, averageRating: 4.75 }));

    expect(summary.state).toBe("present");
    expect(summary.headline).toBe("12 pedidos completados · 4.8 de 5 en 8 reseñas");
  });

  it("counts a single order and a single review in the singular", () => {
    const summary = summarizeSellingHistory(ready({ totalOrders: 1, reviewCount: 1, averageRating: 3 }));

    expect(summary.headline).toBe("1 pedido completado · 3.0 de 5 en 1 reseña");
  });

  it("keeps a poor rating in the summary rather than hiding it", () => {
    const summary = summarizeSellingHistory(ready({ totalOrders: 40, reviewCount: 30, averageRating: 1.9 }));

    expect(summary.headline).toContain("1.9 de 5");
  });

  it("reports sales with no reviews without inventing a rating", () => {
    const summary = summarizeSellingHistory(ready({ totalOrders: 4 }));

    expect(summary.headline).toBe("4 pedidos completados · aún sin reseñas");
  });
});

describe("newSellerNote", () => {
  it("calls a seller new only inside the defined window", () => {
    expect(newSellerNote("2026-09-01", "2026-09-10")).toBe("Nuevo en Plaza Volcanes");
    expect(newSellerNote("2026-09-01", "2026-10-05")).toBeNull();
  });

  it("never infers a recent arrival from the absence of sales", () => {
    // Two years in the plaza with nothing sold is not a new seller.
    expect(newSellerNote("2024-01-01", "2026-09-18")).toBeNull();
  });

  it("says nothing when the join date is unknown", () => {
    expect(newSellerNote(null)).toBeNull();
    expect(newSellerNote(undefined)).toBeNull();
  });
});

describe("publicReputationTier", () => {
  it("keeps the starting tier out of the buyer's view", () => {
    expect(publicReputationTier("standard")).toBeNull();
  });

  it("publishes a tier the shop earned", () => {
    expect(publicReputationTier("reliable")).toBe("reliable");
    expect(publicReputationTier("top_rated")).toBe("top_rated");
  });
});

describe("hasMeasuredHistory", () => {
  it("is false for a shop with nothing observed, and for a failed read", () => {
    expect(hasMeasuredHistory(ready())).toBe(false);
    expect(hasMeasuredHistory({ status: "pending" })).toBe(false);
    expect(hasMeasuredHistory({ status: "unavailable" })).toBe(false);
  });

  it("is true once a single signal has a real value, even a bad one", () => {
    expect(hasMeasuredHistory(ready({ responseRate: 0 }))).toBe(true);
    expect(hasMeasuredHistory(ready({ disputeRate: 40 }))).toBe(true);
  });
});
