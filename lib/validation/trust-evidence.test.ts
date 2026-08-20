import { describe, expect, it } from "vitest";

import { disputeSchema, resolutionSchema, reviewSchema } from "@/lib/validation/trust-evidence";

describe("trust evidence validation", () => {
  it("parses completed-order review evidence", () => {
    expect(reviewSchema.parse({ rating: "5", matched_description: "true", comment: "  Todo coincidió. " })).toEqual({
      rating: 5,
      matched_description: true,
      comment: "Todo coincidió.",
    });
  });

  it.each([0, 6])("rejects rating %i", (rating) => {
    expect(reviewSchema.safeParse({ rating: String(rating), matched_description: "false", comment: "" }).success).toBe(false);
  });

  it("accepts canonical dispute evidence", () => {
    expect(disputeSchema.parse({ reason: "damaged_item", statement: "El producto llegó con una pieza rota." }).reason).toBe("damaged_item");
  });

  it("requires explicit seller-fault decision during resolution", () => {
    expect(resolutionSchema.safeParse({ resolution: "buyer_favor", seller_fault: "", notes: "La evidencia confirma el daño reportado." }).success).toBe(false);
  });
});
