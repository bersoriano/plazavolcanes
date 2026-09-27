import { describe, expect, it } from "vitest";

import {
  FOUNDER_CATEGORY_SLOTS,
  FOUNDERS_CAP,
  FOUNDERS_FALLBACK,
  resolveFoundersProgress,
  toFoundersProgram,
  withFeaturedFounders,
} from "@/lib/launch";

describe("resolveFoundersProgress", () => {
  it("refuses to invent a count", () => {
    for (const value of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(resolveFoundersProgress(value)).toBeNull();
    }
  });

  it("splits the cap into taken and remaining spots", () => {
    expect(resolveFoundersProgress(0)).toEqual({ taken: 0, left: FOUNDERS_CAP, percent: 0 });
    expect(resolveFoundersProgress(37)).toEqual({ taken: 37, left: 63, percent: 37 });
    expect(resolveFoundersProgress(FOUNDERS_CAP)).toEqual({
      taken: FOUNDERS_CAP,
      left: 0,
      percent: 100,
    });
  });

  it("keeps the first spots visible on the bar", () => {
    expect(resolveFoundersProgress(1)?.percent).toBe(2);
    expect(resolveFoundersProgress(2)?.percent).toBe(2);
  });

  it("clamps a count that has run past the cap", () => {
    expect(resolveFoundersProgress(137)).toEqual({ taken: FOUNDERS_CAP, left: 0, percent: 100 });
  });
});

describe("toFoundersProgram", () => {
  it("reads the counter and whether new stores can still land a spot", () => {
    expect(toFoundersProgram({ cap: 100, taken: 38, is_open: true })).toEqual({ open: true, taken: 38, cap: 100 });
    expect(toFoundersProgram({ cap: 100, taken: 100, is_open: false })).toEqual({ open: false, taken: 100, cap: 100 });
  });

  it("keeps the offer up without a number when there is no status to trust", () => {
    expect(toFoundersProgram(null)).toEqual(FOUNDERS_FALLBACK);
    expect(toFoundersProgram({ cap: 100, taken: Number.NaN, is_open: true })).toEqual(FOUNDERS_FALLBACK);
    expect(FOUNDERS_FALLBACK).toEqual({ open: true, taken: null, cap: FOUNDERS_CAP });
  });
});

describe("withFeaturedFounders", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  const row = (id: number, shopId: number, founderSince: string | null = null) => ({
    id,
    shops: { id: shopId, founder_since: founderSince },
  });
  const recent = "2026-10-01T00:00:00Z";
  const expired = "2026-06-01T00:00:00Z";

  it("leads with one product per featured founder, then the rest without repeats", () => {
    const rows = [row(1, 10), row(2, 20, recent), row(3, 30)];
    const candidates = [row(2, 20, recent), row(4, 20, recent), row(5, 40, recent)];

    const result = withFeaturedFounders(rows, candidates, now);

    expect(result.slice(0, 2).map((item) => item.id).sort()).toEqual([2, 5]);
    expect(result.slice(2).map((item) => item.id)).toEqual([1, 3]);
    expect(result.filter((item) => item.id === 2)).toHaveLength(1);
  });

  it("skips founders past their 90 days and caps the slot", () => {
    const candidates = [
      row(1, 1, expired),
      ...Array.from({ length: 6 }, (_, index) => row(10 + index, 100 + index, recent)),
    ];

    const result = withFeaturedFounders([], candidates, now);

    expect(result).toHaveLength(FOUNDER_CATEGORY_SLOTS);
    expect(result.some((item) => item.id === 1)).toBe(false);
  });

  it("leaves the results alone when no founder is featured", () => {
    const rows = [row(1, 10)];
    expect(withFeaturedFounders(rows, [row(2, 20, expired)], now)).toBe(rows);
  });
});
