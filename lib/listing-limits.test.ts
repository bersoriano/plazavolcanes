import { describe, expect, it } from "vitest";

import { hasListingCapacity } from "@/lib/listing-limits";

describe("hasListingCapacity", () => {
  it("allows publication below the cached limit", () => {
    expect(hasListingCapacity(14, 15)).toBe(true);
  });

  it("blocks publication at the cached limit", () => {
    expect(hasListingCapacity(15, 15)).toBe(false);
  });
});
