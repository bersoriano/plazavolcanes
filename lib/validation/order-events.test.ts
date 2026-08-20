import { describe, expect, it } from "vitest";

import { messageSchema, shipmentSchema } from "@/lib/validation/order-events";

describe("order event validation", () => {
  it("trims a buyer or seller message", () => {
    expect(messageSchema.parse({ body: "  Mañana queda enviado.  ", idempotency_key: "30000000-0000-4000-8000-000000000001" })).toEqual({
      body: "Mañana queda enviado.",
      idempotency_key: "30000000-0000-4000-8000-000000000001",
    });
  });

  it.each(["", "x".repeat(2001)])("rejects message outside bounds", (body) => {
    expect(messageSchema.safeParse({ body, idempotency_key: crypto.randomUUID() }).success).toBe(false);
  });

  it("normalizes blank tracking details", () => {
    expect(shipmentSchema.parse({ tracking_text: "", idempotency_key: crypto.randomUUID() }).tracking_text).toBeNull();
  });
});
