import { describe, expect, it } from "vitest";

import {
  PUBLIC_TRUST_MARKERS,
  formatLastActive,
  formatRating,
  formatReplyTime,
  formatTrustPercentage,
  readTrustSignals,
  type PublicTrustMetrics,
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

describe("readTrustSignals", () => {
  const emptyShop = {
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
    evaluatedAt: "2026-08-20T00:00:00.000Z",
  };

  function signal(key: string, metrics: PublicTrustMetrics | null = emptyShop) {
    return readTrustSignals(metrics).find((entry) => entry.key === key)!;
  }

  it("never states a zero response rate the plaza never measured", () => {
    const empty = signal("response_rate");

    expect(empty.state).toBe("empty");
    expect(empty.value).toBe("Sin historial de respuesta");
    expect(empty.value).not.toMatch(/%/);
  });

  it("keeps a real zero response rate, because the denominator was real", () => {
    const measured = signal("response_rate", { ...emptyShop, responseRate: 0 });

    expect(measured.state).toBe("zero");
    expect(measured.value).toBe("0%");
  });

  it("names the window a rate was measured over", () => {
    expect(signal("response_rate", { ...emptyShop, responseRate: 80 }).context).toBe(
      "Últimos 90 días",
    );
  });

  it("keeps genuinely poor results visible", () => {
    const poor = { ...emptyShop, onTimeShippingRate: 0, orderCompletionRate: 12, disputeRate: 40 };

    expect(signal("on_time_shipping", poor).value).toBe("0%");
    expect(signal("order_completion", poor).value).toBe("12%");
    expect(signal("dispute_rate", poor).value).toBe("40%");
    expect(signal("dispute_rate", poor).state).toBe("measured");
  });

  it("does not call a shop with no eligible order dispute-free", () => {
    const empty = signal("dispute_rate");

    expect(empty.state).toBe("empty");
    expect(empty.value).toBe("Sin pedidos evaluados");
  });

  it("keeps a clean record once there were orders to measure", () => {
    const clean = signal("dispute_rate", { ...emptyShop, disputeRate: 0 });

    expect(clean.state).toBe("measured");
    expect(clean.value).toBe("Sin disputas");
  });

  it("says there are no reviews rather than showing a zero rating", () => {
    expect(signal("rating").value).toBe("Aún sin reseñas");
    expect(signal("rating").state).toBe("empty");
    expect(signal("review_count").value).toBe("Aún sin reseñas");
    expect(signal("review_count").state).toBe("empty");
  });

  it("carries the sample size beside a rating", () => {
    const rated = signal("rating", { ...emptyShop, averageRating: 4.82, reviewCount: 12 });

    expect(rated.value).toBe("4.8");
    expect(rated.context).toBe("12 reseñas");
  });

  it("says a shop has no sales rather than printing a bare zero", () => {
    expect(signal("total_orders").value).toBe("Sin ventas registradas");
    expect(signal("total_orders").state).toBe("empty");
  });

  it("marks the seller active only while their presence is current", () => {
    expect(signal("last_active", { ...emptyShop, sellerActiveDaysAgo: 2 })).toMatchObject({
      state: "measured",
      value: "Activo recientemente",
    });
    expect(signal("last_active", { ...emptyShop, sellerActiveDaysAgo: 9 })).toMatchObject({
      state: "empty",
      value: "Hace 9 días",
    });
  });

  it("reads the seller's own presence, not the shop's order activity", () => {
    const busyShopAbsentSeller = { ...emptyShop, lastActiveDaysAgo: 1, sellerActiveDaysAgo: 30 };

    expect(signal("last_active", busyShopAbsentSeller).state).toBe("empty");
  });

  it("reports nothing measured at all without an evaluation", () => {
    for (const entry of readTrustSignals(null)) {
      expect(entry.state).toBe("empty");
    }
  });
});
