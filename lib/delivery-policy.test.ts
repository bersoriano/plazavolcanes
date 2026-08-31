import { describe, expect, it } from "vitest";

import {
  deliveryPolicyUnlocksAt,
  isDeliveryPolicyEditable,
} from "@/lib/delivery-policy";

describe("deliveryPolicyUnlocksAt", () => {
  it("has no unlock date for a shop that never wrote a policy", () => {
    expect(deliveryPolicyUnlocksAt(null)).toBeNull();
  });

  it("falls thirty days after the last change", () => {
    expect(deliveryPolicyUnlocksAt("2026-08-01T10:00:00.000Z")?.toISOString()).toBe(
      "2026-08-31T10:00:00.000Z",
    );
  });
});

describe("isDeliveryPolicyEditable", () => {
  it("lets a shop that never wrote a policy write one", () => {
    expect(isDeliveryPolicyEditable(null, new Date("2026-08-31T12:00:00.000Z"))).toBe(true);
  });

  it("holds a shop that changed its policy this month", () => {
    expect(
      isDeliveryPolicyEditable(
        "2026-08-30T12:00:00.000Z",
        new Date("2026-08-31T12:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("opens again once thirty days have passed", () => {
    expect(
      isDeliveryPolicyEditable(
        "2026-08-01T12:00:00.000Z",
        new Date("2026-08-31T12:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
