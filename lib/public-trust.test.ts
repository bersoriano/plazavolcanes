import { describe, expect, it } from "vitest";

import {
  PUBLIC_TRUST_MARKERS,
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
  it("pairs the average with its review count", () => {
    expect(formatRating(4.82, 12)).toBe("4.8 · 12 reseñas");
  });

  it("keeps a single review singular", () => {
    expect(formatRating(5, 1)).toBe("5.0 · 1 reseña");
  });

  it("says so before the first review", () => {
    expect(formatRating(null, 0)).toBe("Sin datos aún");
    expect(formatRating(null, null)).toBe("Sin datos aún");
  });
});

describe("formatLastActive", () => {
  it("names today, yesterday and older activity", () => {
    expect(formatLastActive(0)).toBe("Hoy");
    expect(formatLastActive(1)).toBe("Hace 1 día");
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
