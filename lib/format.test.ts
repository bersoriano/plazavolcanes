import { describe, expect, it } from "vitest";

import { formatCurrency, formatMxn } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats the requested currency using the requested locale", () => {
    expect(formatCurrency(1299, "USD", "en-US")).toBe("$1,299.00");
  });
});

describe("formatMxn", () => {
  it("formats whole-number prices in Mexican pesos", () => {
    expect(formatMxn(1299)).toBe("$1,299.00");
  });

  it("formats decimal strings without losing cents", () => {
    expect(formatMxn("49.5")).toBe("$49.50");
  });
});
