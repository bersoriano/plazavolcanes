import { describe, expect, it } from "vitest";

import { orderDeliveryLine } from "@/lib/order-summary";

const address = {
  recipient: "Ana Ruiz",
  address_line1: "Calle 1",
  address_line2: null,
  locality: "Zapopan",
  administrative_area: "Jalisco",
  postal_code: "45010",
  country_code: "MX",
  delivery_instructions: null,
  redacted_at: null,
};

describe("orderDeliveryLine", () => {
  it("names the city and state an order ships to, and nothing more", () => {
    expect(orderDeliveryLine("shipping", address)).toBe("Envío a Zapopan, Jalisco");
  });

  it("says a collected order is picked up from the seller", () => {
    expect(orderDeliveryLine("pickup", null)).toBe("Recolección en tu punto de entrega");
  });

  it("falls back to the method when the address is gone or incomplete", () => {
    expect(orderDeliveryLine("shipping", null)).toBe("Envío a domicilio");
    expect(orderDeliveryLine("shipping", { ...address, redacted_at: "2026-09-01T00:00:00Z", locality: null, administrative_area: null })).toBe("Envío a domicilio");
    expect(orderDeliveryLine("shipping", { ...address, administrative_area: null })).toBe("Envío a Zapopan");
  });
});
