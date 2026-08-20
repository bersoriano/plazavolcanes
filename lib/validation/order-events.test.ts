import { describe, expect, it } from "vitest";

import {
  messageSchema,
  sellerCancellationSchema,
  shipmentSchema,
  transitionSchema,
} from "@/lib/validation/order-events";

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

  it.each(["buyer_non_payment", "inventory_unavailable", "seller_unavailable", "other"])(
    "accepts seller cancellation reason %s",
    (reason) => {
      expect(sellerCancellationSchema.parse({ reason, idempotency_key: crypto.randomUUID() }).reason).toBe(reason);
    },
  );

  it("rejects unknown seller cancellation reasons", () => {
    expect(sellerCancellationSchema.safeParse({ reason: "buyer_changed_mind", idempotency_key: crypto.randomUUID() }).success).toBe(false);
  });

  it("requires a UUID for payment and cancellation transitions", () => {
    expect(transitionSchema.safeParse({ idempotency_key: "missing" }).success).toBe(false);
  });
});
