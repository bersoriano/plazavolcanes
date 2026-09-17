import { describe, expect, it } from "vitest";

import { formatOrderStatus } from "@/lib/order-status";

describe("formatOrderStatus", () => {
  it.each([
    ["requested", "Solicitud enviada"],
    ["accepted", "Aceptado"],
    ["shipped", "Enviado"],
    ["delivered", "Recibido"],
    ["completed", "Completado"],
    ["rejected", "Rechazado"],
    ["canceled_by_buyer", "Cancelado por comprador"],
    ["canceled_by_seller", "Cancelado por vendedor"],
    ["canceled_by_admin", "Cancelado por administración"],
  ] as const)("formats %s in Spanish", (status, label) => {
    expect(formatOrderStatus(status)).toBe(label);
  });

  it("says a collected order was handed over, not shipped", () => {
    expect(formatOrderStatus("shipped", "pickup")).toBe("Entregado por la tienda");
    expect(formatOrderStatus("shipped", "shipping")).toBe("Enviado");
    expect(formatOrderStatus("delivered", "pickup")).toBe("Recibido");
  });
});
