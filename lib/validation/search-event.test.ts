import { describe, expect, it } from "vitest";

import { searchEventSelectionSchema } from "@/lib/validation/search-event";

describe("searchEventSelectionSchema", () => {
  it("accepts a UUID event ID with positive product ID and position", () => {
    const result = searchEventSelectionSchema.safeParse({
      eventId: "1f505b54-3e35-4d7c-9a22-472920dfd72b",
      productId: 42,
      position: 1,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a zero result position", () => {
    expect(
      searchEventSelectionSchema.safeParse({
        eventId: "1f505b54-3e35-4d7c-9a22-472920dfd72b",
        productId: 42,
        position: 0,
      }).success,
    ).toBe(false);
  });
});
