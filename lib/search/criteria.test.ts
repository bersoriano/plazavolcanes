import { describe, expect, it } from "vitest";
import {
  readSearchCriteria,
  refineSearchCriteria,
  validateSearchCriteria,
  writeSearchCriteria,
} from "./criteria";

describe("buyer text", () => {
  it.each([
    ["waterproof jacket under $100", { text: "jacket", waterproof: true, max: 100, maxInclusive: false, currency: "MXN" }],
    ["chamarra impermeable por menos de 100 pesos", { text: "chamarra", waterproof: true, max: 100, maxInclusive: false, currency: "MXN" }],
    ["hasta 100 MXN", { max: 100, maxInclusive: true, currency: "MXN" }],
    ["over 50 pesos and up to $100.75", { min: 50, minInclusive: false, max: 100.75, maxInclusive: true, currency: "MXN" }],
    ["chaqueta usada azul de algodón talla M en existencia", { text: "chaqueta", condition: "used", color: "blue", material: "cotton", size: "M", inStock: true }],
    ["new green leather jacket in stock", { text: "jacket", condition: "new", color: "green", material: "leather", inStock: true }],
    ["New Balance 574", { text: "New Balance 574" }],
    ["Under Armour", { text: "Under Armour" }],
    ["tarjeta de red", { text: "tarjeta de red" }],
    ["cable de red", { text: "cable de red" }],
    ["red inalámbrica", { text: "red inalámbrica" }],
    ["red jacket", { color: "red", text: "jacket" }],
    ["Cadillac 2020", { text: "Cadillac 2020" }],
    ['-"black waterproof jacket" gloves', { text: '-"black waterproof jacket" gloves' }],
    ["Euro Truck Simulator 2", { text: "Euro Truck Simulator 2" }],
    ["chaqueta por no más de 100", { text: "chaqueta", max: 100, maxInclusive: true, currency: "MXN" }],
    ['"black leather" OR "blue jacket" -newspaper', { text: '"black leather" OR "blue jacket" -newspaper' }],
    ["rock and roll jacket under $100", { text: "rock and roll jacket", max: 100, maxInclusive: false, currency: "MXN" }],
    ['"black or blue" jacket', { text: '"black or blue" jacket' }],
    ["iphone 16", { text: "iphone 16" }],
  ] as const)("interprets %s", (q, expected) => {
    expect(readSearchCriteria({ q })).toEqual({ criteria: expected, original: q });
  });

  it.each([
    "under $1,000", "under $10.999", "under $-10", "under $100 USD", "menos de cien pesos",
    "black or blue jacket", "not waterproof jacket", "no impermeable", "used or new",
    "under $100 or over $200", "between 50 and 100 pesos", "around $50", "under $100-200",
    "under $100 to 200", "under 100 euros", "under 100 kg", "under 50 pages", "don’t want waterproof", "isn't waterproof", "jacket under fifty bucks", "under about 70",
    "jacket 100 dollars", "chamarra 100 dólares", "under $100 CHF", "under 3000 JPY", "under ¥100", "under .99",
    "under 100 pesos argentinos", "under $100 USD.", "jacket,not waterproof",
    "under $100 Canadian dollars", "under 100 GBP", "waterproof or non-waterproof", "under 1e2", "under 100k",
  ])("fails closed for %s", (q) => {
    expect(readSearchCriteria({ q })).toMatchObject({ criteria: {}, original: q, error: expect.any(String) });
  });

  it("requires explicit pesos outside the Mexico market", () => {
    expect(readSearchCriteria({ q: "under $100", countryCode: "US" }).error).toBeTruthy();
    expect(readSearchCriteria({ q: "hasta 100", countryCode: "US" }).error).toBeTruthy();
    expect(readSearchCriteria({ q: "hasta 100 MXN", countryCode: "US" }).criteria).toMatchObject({ max: 100, currency: "MXN" });
    expect(readSearchCriteria({ q: "under 100 pesos", countryCode: "US" }).criteria).toMatchObject({ max: 100, currency: "MXN" });
  });

  it("validates raw length before extracting any terminal constraint", () => {
    const budget = " under $100";
    for (const length of [201, 500, 501]) {
      const q = "a".repeat(length - budget.length) + budget;
      const result = readSearchCriteria({ q });
      if (length === 501) expect(result.error).toBeTruthy();
      else expect(result.criteria.max).toBe(100);
    }
  });
});

describe("catalog query string", () => {
  it("preserves literal filter words on navigation", () => {
    const first = readSearchCriteria({ q: '"waterproof" jacket under $100' });
    const encoded = writeSearchCriteria(first.criteria);
    expect(encoded.get("texto")).toBe('"waterproof" jacket');
    expect(encoded.has("q")).toBe(false);
    expect(readSearchCriteria(Object.fromEntries(encoded))).toEqual({ criteria: first.criteria });
  });

  it("intersects explicit bounds by strength and respects equality", () => {
    expect(readSearchCriteria({ q: "under $80", max: "100", min: "0" }).criteria).toMatchObject({ max: 80, maxInclusive: false, min: 0 });
    expect(readSearchCriteria({ q: "up to $100", max: "100", maxInclusive: "false" }).criteria.maxInclusive).toBe(false);
    expect(readSearchCriteria({ q: "under $80", min: "80" }).error).toBeTruthy();
    expect(readSearchCriteria({ q: "red jacket", color: "blue" }).error).toBeTruthy();
  });

  it.each([
    { q: "", texto: "literal" }, { max: ["100", "200"] }, { max: "Infinity" },
    { min: "" }, { min: "1.001" }, { max: "-1" }, { currency: "USD" }, { condition: "new", grade: "mint" },
    { waterproof: "yes" }, { maxInclusive: "false" }, { color: "not-a-color" },
    { categoria: ["a", "b"] }, { max: "0", maxInclusive: "false" },
  ])("rejects invalid explicit fields %j", (params) => {
    expect(readSearchCriteria(params)).toMatchObject({ criteria: {}, error: expect.any(String) });
  });

  it("accepts equivalent repeated values, unrelated route fields and grade-implied used condition", () => {
    expect(readSearchCriteria({ grade: ["good", "good"], notice: "saved" }).criteria).toEqual({ grade: "good", condition: "used" });
  });
});

describe("validated conversational state", () => {
  it("validates selectors and rejects unknown keys or coercion", () => {
    expect(validateSearchCriteria({ categorySlug: "ropa", administrativeAreaSlug: "jalisco", locale: "es-MX", countryCode: "MX" }).error).toBeUndefined();
    for (const input of [{ categorySlug: "A/B" }, { administrativeAreaSlug: "nowhere" }, { locale: "de-DE" }, { max: "100" }, { sql: "x" }, { min: 0.001 }]) {
      expect(validateSearchCriteria(input).error).toBeTruthy();
    }
  });

  it("requires a parent for a subcategory and clears the child when removing its parent", () => {
    const selected = { categorySlug: "ropa", subcategorySlug: "chamarras", max: 99 };
    expect(validateSearchCriteria({ subcategorySlug: "chamarras" }).error).toBeTruthy();
    expect(refineSearchCriteria(selected, { clear: ["categorySlug"] }).criteria).toEqual({
      max: 99, maxInclusive: true, currency: "MXN",
    });
    expect(refineSearchCriteria(selected, {
      clear: ["categorySlug"], set: { subcategorySlug: "otra" },
    }).error).toBeTruthy();
  });

  it("replaces or clears only requested fields and revalidates on reset", () => {
    const base = readSearchCriteria({ q: "black waterproof jacket under $100" }).criteria;
    const blue = refineSearchCriteria(base, { set: { color: "blue" } }).criteria;
    expect(blue).toMatchObject({ text: "jacket", waterproof: true, max: 100, maxInclusive: false, color: "blue" });
    const cheaper = refineSearchCriteria(blue, { set: { max: 80 }, clear: ["waterproof"] }).criteria;
    expect(cheaper).toEqual({ text: "jacket", color: "blue", max: 80, maxInclusive: false, currency: "MXN" });
    expect(refineSearchCriteria(cheaper, { clear: ["max"] }).criteria).toEqual({ text: "jacket", color: "blue" });
    expect(refineSearchCriteria(cheaper, { set: { min: 90 } }).error).toBeTruthy();
    expect(refineSearchCriteria(cheaper, { reset: true, set: { grade: "mint" } }).criteria).toEqual({ grade: "mint", condition: "used" });
    expect(refineSearchCriteria(cheaper, { clear: ["sql"] }).error).toBeTruthy();
    expect(refineSearchCriteria(cheaper, { clear: ["currency"] }).error).toBeTruthy();
    expect(refineSearchCriteria({ grade: "good" }, { clear: ["condition"] }).criteria).toEqual({});
  });
});
