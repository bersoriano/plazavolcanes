import { describe, expect, it } from "vitest";

import {
  listingQualityTips,
  missingForPublication,
  type ListingReadinessInput,
} from "@/lib/listing-readiness";

const empty: ListingReadinessInput = {
  imageCount: 0,
  name: null,
  description: null,
  price_mxn: null,
  condition: null,
  used_condition: null,
  units_available: null,
  handling_days: null,
  category_id: null,
};

const ready: ListingReadinessInput = {
  imageCount: 3,
  name: "Taza de barro negro de Oaxaca",
  description:
    "Taza torneada a mano en barro negro, cocida en horno de leña. Mide 9 cm de alto y 8 de diámetro, cabe 300 ml.",
  price_mxn: 349,
  condition: "new",
  used_condition: null,
  units_available: 2,
  handling_days: 3,
  category_id: 11,
};

describe("missingForPublication", () => {
  it("names every requirement an empty listing has not met", () => {
    expect(missingForPublication(empty).map((item) => item.field)).toEqual([
      "images",
      "name",
      "description",
      "price_mxn",
      "condition",
      "units_available",
      "handling_days",
      "category_id",
    ]);
  });

  it("finds nothing missing in a complete listing", () => {
    expect(missingForPublication(ready)).toEqual([]);
  });

  it("asks for the used condition only once the seller says the product is used", () => {
    const fields = missingForPublication({ ...ready, condition: "used", used_condition: null }).map(
      (item) => item.field,
    );

    expect(fields).toEqual(["used_condition"]);
    expect(missingForPublication({ ...ready, condition: "used", used_condition: "good" })).toEqual([]);
  });

  it("points each requirement at the control that fixes it", () => {
    const targets = new Map(missingForPublication(empty).map((item) => [item.field, item.target]));

    expect(targets.get("images")).toBe("product-images");
    expect(targets.get("category_id")).toBe("category-leaf");
    expect(targets.get("price_mxn")).toBe("price_mxn");
  });

  it("treats a free listing and a half-written description as unmet requirements", () => {
    const fields = missingForPublication({
      ...ready,
      price_mxn: 0,
      description: "Muy corta.",
      units_available: 0,
      handling_days: 45,
    }).map((item) => item.field);

    expect(fields).toEqual(["description", "price_mxn", "units_available", "handling_days"]);
  });
});

describe("listingQualityTips", () => {
  it("asks for more photos while a listing has fewer than three", () => {
    expect(listingQualityTips({ ...ready, imageCount: 1 }).map((tip) => tip.field)).toContain(
      "images",
    );
    expect(listingQualityTips(ready).map((tip) => tip.field)).not.toContain("images");
  });

  it("asks for a fuller description while the seller wrote barely enough to publish", () => {
    expect(
      listingQualityTips({ ...ready, description: "Taza de barro hecha a mano." }).map(
        (tip) => tip.field,
      ),
    ).toContain("description");
  });

  it("stays quiet about what a listing is still missing, which is not a suggestion", () => {
    expect(listingQualityTips(empty).map((tip) => tip.field)).not.toContain("price_mxn");
  });
});
