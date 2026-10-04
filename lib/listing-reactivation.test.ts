import { describe, expect, it } from "vitest";

import { listingPublishBlocker, planReactivation, reactivationMessage, type ReactivationCandidate } from "@/lib/listing-reactivation";

function candidate(overrides: Partial<ReactivationCandidate> = {}): ReactivationCandidate {
  return {
    id: 1,
    name: "Florero",
    image_path: "seller/florero.webp",
    units_available: 2,
    category_id: 11,
    needsSlot: true,
    ...overrides,
  };
}

describe("listingPublishBlocker", () => {
  it("lets a listing with a cover and units go back up", () => {
    expect(listingPublishBlocker({ image_path: "x.webp", units_available: 1 })).toBeNull();
  });

  it("asks for a cover first, then for units", () => {
    expect(listingPublishBlocker({ image_path: null, units_available: 0 })).toBe("cover");
    expect(listingPublishBlocker({ image_path: "x.webp", units_available: 0 })).toBe("units");
    expect(listingPublishBlocker({ image_path: "x.webp", units_available: null })).toBe("units");
  });

  it("asks a lapsed listing for a cover too, since renewing it is a new publication", () => {
    expect(listingPublishBlocker({ image_path: null, units_available: 3 })).toBe("cover");
  });
});

describe("planReactivation", () => {
  const categories = new Set([11]);

  it("brings back every listing that passes, up to the free slots", () => {
    const plan = planReactivation(
      [candidate({ id: 1 }), candidate({ id: 2, name: "Jarra" }), candidate({ id: 3, name: "Taza" })],
      { publishableCategoryIds: categories, slotsLeft: 2 },
    );

    expect(plan.reactivate.map((item) => item.id)).toEqual([1, 2]);
    expect(plan.skipped).toEqual([{ name: "Taza", reason: "limit" }]);
  });

  it("says why each one stays down", () => {
    const plan = planReactivation(
      [
        candidate({ id: 1, name: "Sin foto", image_path: null }),
        candidate({ id: 2, name: "Agotado", units_available: 0 }),
        candidate({ id: 3, name: "Mal clasificado", category_id: 99 }),
        candidate({ id: 4, name: "Sin categoría", category_id: null }),
      ],
      { publishableCategoryIds: categories, slotsLeft: 10 },
    );

    expect(plan.reactivate).toEqual([]);
    expect(plan.skipped).toEqual([
      { name: "Sin foto", reason: "cover" },
      { name: "Agotado", reason: "units" },
      { name: "Mal clasificado", reason: "category" },
      { name: "Sin categoría", reason: "category" },
    ]);
  });

  it("does not spend a slot on a listing that still holds one", () => {
    const plan = planReactivation(
      [candidate({ id: 1, needsSlot: false }), candidate({ id: 2 })],
      { publishableCategoryIds: categories, slotsLeft: 1 },
    );

    expect(plan.reactivate.map((item) => item.id)).toEqual([1, 2]);
    expect(plan.skipped).toEqual([]);
  });
});

describe("reactivationMessage", () => {
  it("counts what came back and names what did not", () => {
    expect(
      reactivationMessage(5, [
        { name: "Jarra", reason: "units" },
        { name: "Taza", reason: "cover" },
        { name: "Vaso", reason: "limit" },
      ]),
    ).toBe("Reactivamos 5 productos. No reactivamos: Jarra (sin unidades), Taza (sin portada), Vaso (límite de publicaciones).");
  });

  it("reads naturally for one, for none and for a clean sweep", () => {
    expect(reactivationMessage(1, [])).toBe("Reactivamos 1 producto.");
    expect(reactivationMessage(0, [{ name: "Jarra", reason: "category" }])).toBe(
      "No pudimos reactivar ningún producto: Jarra (subcategoría no válida).",
    );
  });
});
