import { describe, expect, it } from "vitest";

import { formatMxn } from "@/lib/format";

describe("formatMxn", () => {
  it("formats whole-number prices in Mexican pesos", () => {
    expect(formatMxn(1299)).toBe("$1,299.00");
  });

  it("formats decimal strings without losing cents", () => {
    expect(formatMxn("49.5")).toBe("$49.50");
  });
});
