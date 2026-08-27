import { describe, expect, it } from "vitest";

import { pickupPointFrom } from "@/lib/actions/shop-pickup-point";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("pickupPointFrom", () => {
  it("reports no offer when the checkbox is absent", () => {
    const result = pickupPointFrom(form({ name: "Tienda" }));
    expect(result.offered).toBe(false);
    expect(result.parsed).toBeNull();
  });

  it("parses the pickup fields when the checkbox is on", () => {
    const result = pickupPointFrom(
      form({
        offers_pickup: "on",
        pickup_address_line1: "Av. Vallarta 1234",
        pickup_locality: "Zapopan",
        pickup_administrative_area_code: "MX-JAL",
        pickup_postal_code: "45010",
        pickup_notes: "Portón verde",
      }),
    );

    expect(result.offered).toBe(true);
    expect(result.parsed?.success).toBe(true);
    expect(result.parsed?.data?.address_line1).toBe("Av. Vallarta 1234");
  });

  it("reports the failure when the checkbox is on and a field is missing", () => {
    const result = pickupPointFrom(
      form({ offers_pickup: "on", pickup_address_line1: "Av. Vallarta 1234" }),
    );

    expect(result.offered).toBe(true);
    expect(result.parsed?.success).toBe(false);
  });
});
