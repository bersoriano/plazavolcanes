import { describe, expect, it } from "vitest";

import { FOUNDERS_CAP, FOUNDERS_FALLBACK, resolveFoundersProgress, toFoundersProgram } from "@/lib/launch";

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
