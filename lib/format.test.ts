import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, formatMxn } from "@/lib/format";

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

describe("formatDate", () => {
  it("formats ISO timestamps as Spanish calendar dates", () => {
    expect(formatDate("2026-08-20T12:30:00.000Z")).toBe("20 de agosto de 2026");
  });
});
