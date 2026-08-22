import { describe, expect, it } from "vitest";

import {
  PUBLIC_TRUST_MARKERS,
  formatDisputeRate,
  formatLastActive,
  formatRating,
  formatReplyTime,
  formatTrustPercentage,
} from "@/lib/public-trust";

describe("formatTrustPercentage", () => {
  it("rounds to a single decimal", () => {
    expect(formatTrustPercentage(97.456)).toBe("97.5%");
    expect(formatTrustPercentage(100)).toBe("100%");
  });

  it("says so when nothing has been measured", () => {
    expect(formatTrustPercentage(null)).toBe("Sin datos aún");
  });
});

describe("formatReplyTime", () => {
  it("keeps short replies in minutes", () => {
    expect(formatReplyTime(42)).toBe("42 min");
  });

  it("switches to hours once an hour has passed", () => {
    expect(formatReplyTime(60)).toBe("1 h");
    expect(formatReplyTime(150)).toBe("2.5 h");
  });

  it("says so when nothing has been measured", () => {
    expect(formatReplyTime(null)).toBe("Sin datos aún");
  });
});

describe("formatRating", () => {
  it("shows one decimal of the average", () => {
    expect(formatRating(4.82, 12)).toBe("4.8");
    expect(formatRating(5, 1)).toBe("5.0");
  });

  it("says so when the average exists but nobody has reviewed", () => {
    expect(formatRating(4.5, 0)).toBe("Sin datos aún");
  });

  it("says so before the first review", () => {
    expect(formatRating(null, 0)).toBe("Sin datos aún");
    expect(formatRating(null, null)).toBe("Sin datos aún");
  });
});

describe("formatLastActive", () => {
  it("calls a seller seen within three days recently active", () => {
    expect(formatLastActive(0)).toBe("Activo recientemente");
    expect(formatLastActive(1)).toBe("Activo recientemente");
    expect(formatLastActive(3)).toBe("Activo recientemente");
  });

  it("reports how long it has been once the window has passed", () => {
    expect(formatLastActive(4)).toBe("Hace 4 días");
    expect(formatLastActive(9)).toBe("Hace 9 días");
  });

  it("says so when nothing has been measured", () => {
    expect(formatLastActive(null)).toBe("Sin datos aún");
  });
});

describe("PUBLIC_TRUST_MARKERS", () => {
  it("covers every dimension the evaluator uses", () => {
    expect(PUBLIC_TRUST_MARKERS).toHaveLength(10);
    for (const marker of PUBLIC_TRUST_MARKERS) {
      expect(marker.label.length).toBeGreaterThan(0);
      expect(marker.explanation.length).toBeGreaterThan(0);
    }
  });
});

describe("PUBLIC_TRUST_MARKERS measured state", () => {
  const zeroed = {
    averageReplyTimeMinutes: null,
    responseRate: null,
    descriptionAccuracy: null,
    onTimeShippingRate: null,
    orderCompletionRate: null,
    disputeRate: 0,
    totalOrders: 0,
    averageRating: null,
    reviewCount: 0,
    lastActiveDaysAgo: null,
    sellerActiveDaysAgo: null,
    evaluatedAt: "2026-08-20T00:00:00.000Z",
  };

  function marker(key: string) {
    return PUBLIC_TRUST_MARKERS.find((entry) => entry.key === key)!;
  }

  it("marks the seller active only while their presence is current", () => {
    expect(marker("last_active").measured({ ...zeroed, sellerActiveDaysAgo: 2 })).toBe(true);
    expect(marker("last_active").value({ ...zeroed, sellerActiveDaysAgo: 2 })).toBe(
      "Activo recientemente",
    );
    expect(marker("last_active").measured({ ...zeroed, sellerActiveDaysAgo: 9 })).toBe(false);
    expect(marker("last_active").value({ ...zeroed, sellerActiveDaysAgo: 9 })).toBe("Hace 9 días");
  });

  it("reads the seller's own presence, not the shop's order activity", () => {
    const busyShopAbsentSeller = { ...zeroed, lastActiveDaysAgo: 1, sellerActiveDaysAgo: 30 };

    expect(marker("last_active").measured(busyShopAbsentSeller)).toBe(false);
  });

  it("treats a shop with no orders or reviews as unmeasured on those signals", () => {
    expect(marker("total_orders").measured(zeroed)).toBe(false);
    expect(marker("review_count").measured(zeroed)).toBe(false);
  });

  it("still shows the real zero rather than hiding it", () => {
    expect(marker("total_orders").value(zeroed)).toBe("0");
    expect(marker("review_count").value(zeroed)).toBe("0");
  });

  it("keeps a zero dispute rate as a genuine measurement", () => {
    expect(marker("dispute_rate").measured(zeroed)).toBe(true);
    expect(marker("dispute_rate").value(zeroed)).toBe("Sin disputas");
  });

  it("counts a signal as measured once it carries a value", () => {
    const busy = { ...zeroed, totalOrders: 34, reviewCount: 12, responseRate: 98 };

    expect(marker("total_orders").measured(busy)).toBe(true);
    expect(marker("review_count").measured(busy)).toBe(true);
    expect(marker("response_rate").measured(busy)).toBe(true);
  });

  it("reports nothing measured without an evaluation, except a clean dispute record", () => {
    for (const entry of PUBLIC_TRUST_MARKERS) {
      expect(entry.measured(null)).toBe(entry.key === "dispute_rate");
    }
  });

  it("treats a shop with no disputes as earning the badge, evaluated or not", () => {
    expect(marker("dispute_rate").measured(null)).toBe(true);
    expect(marker("dispute_rate").value(null)).toBe("Sin disputas");
    expect(marker("dispute_rate").measured({ ...zeroed, disputeRate: null })).toBe(true);
    expect(marker("dispute_rate").value({ ...zeroed, disputeRate: null })).toBe("Sin disputas");
  });

  it("still reports a real dispute rate when there is one", () => {
    const disputed = { ...zeroed, disputeRate: 12 };

    expect(marker("dispute_rate").measured(disputed)).toBe(true);
    expect(marker("dispute_rate").value(disputed)).toBe("12%");
  });
});

describe("formatDisputeRate", () => {
  it("states a clean record rather than a rate", () => {
    expect(formatDisputeRate(null)).toBe("Sin disputas");
    expect(formatDisputeRate(0)).toBe("Sin disputas");
  });

  it("reports the rate once disputes exist", () => {
    expect(formatDisputeRate(12)).toBe("12%");
    expect(formatDisputeRate(2.55)).toBe("2.6%");
  });
});
