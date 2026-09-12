import { describe, expect, it } from "vitest";

import { ORDER_EVENT_TYPES, formatDisputeStatus, formatOrderEvent } from "@/lib/order-events";

describe("formatOrderEvent", () => {
  it.each([
    ["requested", "Solicitud enviada"],
    ["accepted", "Aceptada por la tienda"],
    ["rejected", "Rechazada por la tienda"],
    ["payment_confirmed", "Pago confirmado"],
    ["shipped", "Enviado"],
    ["delivered", "Recibido"],
    ["completed", "Compra completada"],
    ["auto_completed", "Completada automáticamente"],
    ["canceled_by_buyer", "Cancelada por el comprador"],
    ["canceled_by_seller", "Cancelada por la tienda"],
    ["canceled_by_admin", "Cancelada por administración"],
    ["admin_delivery_confirmed", "Entrega confirmada por administración"],
    ["admin_repair", "Corrección de administración"],
  ] as const)("reads %s as %s", (eventType, label) => {
    expect(formatOrderEvent(eventType)).toBe(label);
  });

  it("covers every event type the database allows", () => {
    // The generated types call event_type a plain string, so nothing here is
    // checked at compile time. This test is the exhaustiveness check: the list
    // mirrors the check constraint, and a value added to one without the other
    // fails here rather than reaching a buyer's screen.
    expect(ORDER_EVENT_TYPES).toHaveLength(13);
    for (const eventType of ORDER_EVENT_TYPES) {
      expect(formatOrderEvent(eventType)).not.toMatch(/_/);
    }
  });

  it("never prints a raw column value it does not recognise", () => {
    // A later migration can widen the constraint without touching this file.
    // The fallback has to stay readable Spanish rather than leak the enum.
    expect(formatOrderEvent("some_future_event")).toBe("Actualización del pedido");
  });
});

describe("formatDisputeStatus", () => {
  it.each([
    ["open", "abierta"],
    ["seller_responded", "con respuesta de la tienda"],
    ["resolved", "resuelta"],
  ] as const)("reads %s as %s", (status, label) => {
    expect(formatDisputeStatus(status)).toBe(label);
  });

  it("reads as a sentence after the word it follows", () => {
    // Both order pages render "Disputa {status}", so the labels are lowercase
    // fragments rather than standalone titles.
    expect(`Disputa ${formatDisputeStatus("seller_responded")}`).toBe(
      "Disputa con respuesta de la tienda",
    );
  });
});
