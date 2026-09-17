import { describe, expect, it } from "vitest";

import {
  buyerOrderGuidance,
  deadlineUrgency,
  formatDeadline,
  groupSellerOrders,
  replyDeadline,
  sellerOrderGuidance,
  sellerOrderStep,
  type SellerOrderFacts,
} from "@/lib/seller-action-queue";

const NOW = new Date("2026-09-16T12:00:00.000Z");
const ZONE = "America/Mexico_City";

function hoursFromNow(hours: number) {
  return new Date(NOW.getTime() + hours * 3_600_000).toISOString();
}

function facts(overrides: Partial<SellerOrderFacts> = {}): SellerOrderFacts {
  return {
    status: "requested",
    fulfillment_method: "shipping",
    payment_confirmation_required: true,
    payment_completed_at: null,
    ship_by_at: null,
    delivered_at: null,
    handling_time_zone: ZONE,
    ...overrides,
  };
}

describe("sellerOrderStep", () => {
  it("leaves a purchase request to the seller, with no deadline the system never set", () => {
    expect(sellerOrderStep(facts())).toEqual({ kind: "decide", owner: "seller", dueAt: null });
  });

  it("asks for payment confirmation first, while the ship-by promise keeps running", () => {
    const shipBy = hoursFromNow(30);

    expect(sellerOrderStep(facts({ status: "accepted", ship_by_at: shipBy }))).toEqual({
      kind: "confirm_payment",
      owner: "seller",
      dueAt: shipBy,
    });
  });

  it("names the hand-over by how the buyer receives the order", () => {
    const paid = { status: "accepted" as const, payment_completed_at: hoursFromNow(-2), ship_by_at: hoursFromNow(30) };

    expect(sellerOrderStep(facts({ ...paid, fulfillment_method: "shipping" })).kind).toBe("ship");
    expect(sellerOrderStep(facts({ ...paid, fulfillment_method: "pickup" })).kind).toBe("hand_over");
    // Orders that never needed a payment confirmation go straight to the hand-over.
    expect(sellerOrderStep(facts({ status: "accepted", payment_confirmation_required: false })).kind).toBe("ship");
  });

  it("hands shipped and received orders to the buyer", () => {
    expect(sellerOrderStep(facts({ status: "shipped" }))).toEqual({ kind: "await_receipt", owner: "buyer", dueAt: null });
    expect(sellerOrderStep(facts({ status: "delivered", delivered_at: "2026-09-15T18:00:00.000Z" }))).toEqual({
      kind: "await_confirmation",
      owner: "buyer",
      dueAt: null,
      autoCompleteAt: "2026-09-22T18:00:00.000Z",
    });
  });

  it("closes every terminal status", () => {
    for (const status of ["completed", "rejected", "canceled_by_buyer", "canceled_by_seller", "canceled_by_admin"] as const) {
      expect(sellerOrderStep(facts({ status }))).toEqual({ kind: "closed", owner: "nobody", dueAt: null });
    }
  });
});

describe("deadlines", () => {
  it("rates a deadline as passed, close or comfortable", () => {
    expect(deadlineUrgency(hoursFromNow(-1), NOW, 24)).toBe("overdue");
    expect(deadlineUrgency(hoursFromNow(0), NOW, 24)).toBe("overdue");
    expect(deadlineUrgency(hoursFromNow(23), NOW, 24)).toBe("due_soon");
    expect(deadlineUrgency(hoursFromNow(30), NOW, 24)).toBe("none");
    expect(deadlineUrgency(null, NOW, 24)).toBe("none");
  });

  it("gives an order thread the 24 hours the response rate measures", () => {
    expect(replyDeadline("2026-09-16T01:15:00.000Z")).toBe("2026-09-17T01:15:00.000Z");
  });

  it("prints a deadline in the time zone the promise was made in", () => {
    const label = formatDeadline("2026-09-18T20:30:00.000Z", ZONE);

    expect(label).toMatch(/18 de sept?/);
    expect(label).toContain("2:30");
    expect(label).not.toContain("2026-09-18T");
  });
});

describe("sellerOrderGuidance", () => {
  it("tells the seller a request waits on their decision, without inventing a deadline", () => {
    const guidance = sellerOrderGuidance(facts(), NOW);

    expect(guidance.title).toBe("El comprador espera tu decisión");
    expect(guidance.detail).toContain("sigue pendiente hasta que decidas");
    expect(guidance.deadline).toBeNull();
  });

  it("explains that payment is agreed outside the plaza and must be confirmed first", () => {
    const guidance = sellerOrderGuidance(facts({ status: "accepted", ship_by_at: "2026-09-18T20:30:00.000Z" }), NOW);

    expect(guidance.title).toBe("El comprador espera tus indicaciones de pago");
    expect(guidance.detail).toContain("fuera de la plaza");
    expect(guidance.detail).toContain("marcarlo como enviado");
    expect(guidance.deadline).toMatchObject({ dateTime: "2026-09-18T20:30:00.000Z", urgency: "none" });
    expect(guidance.deadline?.label).toMatch(/^Fecha comprometida para enviar: .*18 de sept?/);
  });

  it("speaks of shipping only for shipped orders and of collection for pickup", () => {
    const paid = { status: "accepted" as const, payment_completed_at: "2026-09-16T10:00:00.000Z", ship_by_at: hoursFromNow(10) };
    const shipping = sellerOrderGuidance(facts({ ...paid, fulfillment_method: "shipping" }), NOW);
    const pickup = sellerOrderGuidance(facts({ ...paid, fulfillment_method: "pickup" }), NOW);

    expect(shipping.title).toBe("El comprador espera su envío");
    expect(shipping.deadline).toMatchObject({ urgency: "due_soon" });
    expect(shipping.deadline?.label).toMatch(/^Fecha comprometida para enviar/);
    expect(pickup.title).toBe("El comprador espera recoger su pedido");
    expect(pickup.detail).toContain("márcalo como entregado");
    expect(pickup.deadline?.label).toMatch(/^Fecha comprometida para entregar/);
    for (const text of [pickup.title, pickup.detail, pickup.deadline?.label ?? ""]) {
      expect(text).not.toMatch(/env[ií]/i);
    }
  });

  it("says when the promised date has already passed", () => {
    const guidance = sellerOrderGuidance(
      facts({ status: "accepted", payment_completed_at: "2026-09-10T10:00:00.000Z", ship_by_at: hoursFromNow(-3), fulfillment_method: "pickup" }),
      NOW,
    );

    expect(guidance.deadline).toMatchObject({ urgency: "overdue" });
    expect(guidance.deadline?.label).toMatch(/^La fecha comprometida para entregar ya pasó: /);
  });

  it("leaves shipped and received orders with the buyer, naming the real completion rule", () => {
    expect(sellerOrderGuidance(facts({ status: "shipped" }), NOW).title).toBe("El comprador debe confirmar que lo recibió");
    expect(sellerOrderGuidance(facts({ status: "shipped", fulfillment_method: "pickup" }), NOW).title).toBe(
      "El comprador debe confirmar que lo recogió",
    );

    const delivered = sellerOrderGuidance(facts({ status: "delivered", delivered_at: "2026-09-15T18:00:00.000Z" }), NOW);
    expect(delivered.title).toBe("El comprador debe confirmar que todo está bien");
    expect(delivered.detail).toMatch(/se completa automáticamente a partir del .*22 de sept?/);
    expect(delivered.detail).toContain("disputa abierta");
    expect(delivered.deadline).toBeNull();
  });

  it("has nothing pending once an order is over", () => {
    expect(sellerOrderGuidance(facts({ status: "completed" }), NOW)).toEqual({
      title: "Pedido completado",
      detail: "No hay nada pendiente.",
      deadline: null,
    });
    expect(sellerOrderGuidance(facts({ status: "canceled_by_buyer" }), NOW).title).toBe("Pedido cerrado");
  });

  it("never promises that the buyer gets a notification", () => {
    const statuses = ["requested", "accepted", "shipped", "delivered", "completed", "rejected"] as const;
    for (const status of statuses) {
      const { title, detail } = sellerOrderGuidance(facts({ status }), NOW);
      expect(`${title} ${detail}`).not.toMatch(/notific|avis|correo/i);
    }
  });
});

describe("buyerOrderGuidance", () => {
  it("tells the buyer the shop is deciding, without a deadline it never set", () => {
    const guidance = buyerOrderGuidance(facts(), NOW);

    expect(guidance).toMatchObject({ label: "Esperando a la tienda", title: "La tienda está revisando tu solicitud", deadline: null });
    expect(guidance.detail).toContain("no tiene un plazo fijo");
  });

  it("explains that payment is agreed with the shop, outside the plaza, and names the shop's promise", () => {
    const guidance = buyerOrderGuidance(facts({ status: "accepted", ship_by_at: "2026-09-18T20:30:00.000Z" }), NOW);

    expect(guidance.label).toBe("Pago por acordar");
    expect(guidance.detail).toContain("fuera de la plaza");
    expect(guidance.deadline).toMatchObject({ dateTime: "2026-09-18T20:30:00.000Z", urgency: "none" });
    expect(guidance.deadline?.label).toMatch(/^La tienda se comprometió a enviarlo antes del .*18 de sept?/);
  });

  it("speaks of collecting, never of shipping, on a pickup order", () => {
    const paid = { fulfillment_method: "pickup" as const, payment_completed_at: "2026-09-15T10:00:00.000Z", ship_by_at: hoursFromNow(30) };
    const waiting = buyerOrderGuidance(facts({ ...paid, status: "accepted" }), NOW);
    const handedOver = buyerOrderGuidance(facts({ ...paid, status: "shipped" }), NOW);

    expect(waiting.label).toBe("Por recoger");
    expect(waiting.deadline?.label).toMatch(/^La tienda se comprometió a entregarlo antes del /);
    expect(handedOver).toMatchObject({ label: "Entregado por la tienda", title: "La tienda marcó tu pedido como entregado" });
    for (const guidance of [waiting, handedOver]) {
      for (const text of [guidance.label, guidance.title, guidance.detail, guidance.deadline?.label ?? ""]) {
        expect(text).not.toMatch(/env[ií]/i);
      }
    }
  });

  it("says when the shop's promised date has passed and what the buyer can do", () => {
    const guidance = buyerOrderGuidance(
      facts({ status: "accepted", payment_completed_at: "2026-09-10T10:00:00.000Z", ship_by_at: hoursFromNow(-3) }),
      NOW,
    );

    expect(guidance).toMatchObject({ label: "Esperando envío", deadline: { urgency: "overdue" } });
    expect(guidance.deadline?.label).toMatch(/^La fecha que la tienda comprometió para enviarlo ya pasó: /);
    expect(guidance.detail).toContain("escríbele en la conversación");
  });

  it("asks the buyer to confirm, naming the real completion rule", () => {
    expect(buyerOrderGuidance(facts({ status: "shipped" }), NOW)).toMatchObject({ label: "En camino", title: "Tu pedido va en camino" });

    const delivered = buyerOrderGuidance(facts({ status: "delivered", delivered_at: "2026-09-15T18:00:00.000Z" }), NOW);
    expect(delivered.title).toBe("Confirma que todo está bien");
    expect(delivered.detail).toMatch(/se completa automáticamente a partir del .*22 de sept?/);
    expect(delivered.detail).toContain("disputa abierta");
  });

  it("closes finished orders in words", () => {
    expect(buyerOrderGuidance(facts({ status: "completed" }), NOW)).toMatchObject({ title: "Compra completada", detail: "No hay nada pendiente." });
    expect(buyerOrderGuidance(facts({ status: "rejected" }), NOW).title).toBe("La tienda rechazó tu solicitud");
    expect(buyerOrderGuidance(facts({ status: "canceled_by_seller" }), NOW).label).toBe("Cancelado por vendedor");
  });

  it("never promises that anybody gets a notification", () => {
    const statuses = ["requested", "accepted", "shipped", "delivered", "completed", "rejected", "canceled_by_buyer"] as const;
    for (const status of statuses) {
      const { label, title, detail } = buyerOrderGuidance(facts({ status }), NOW);
      expect(`${label} ${title} ${detail}`).not.toMatch(/notific|avis|correo|sabr[áa]/i);
    }
  });
});

describe("groupSellerOrders", () => {
  const base = { subtotal: 100, currency_code: "MXN", shop: { id: 1, name: "Casa Niebla", slug: "casa-niebla" } };

  it("splits orders into the seller's turn, the buyer's turn and history", () => {
    const orders = [
      { ...base, ...facts({ status: "completed" }), id: 1, created_at: "2026-09-01T00:00:00.000Z" },
      { ...base, ...facts({ status: "shipped" }), id: 2, created_at: "2026-09-02T00:00:00.000Z" },
      { ...base, ...facts(), id: 3, created_at: "2026-09-10T00:00:00.000Z" },
      { ...base, ...facts(), id: 4, created_at: "2026-09-09T00:00:00.000Z" },
      {
        ...base,
        ...facts({ status: "accepted", payment_completed_at: "2026-09-12T00:00:00.000Z", ship_by_at: hoursFromNow(-1) }),
        id: 5,
        created_at: "2026-09-11T00:00:00.000Z",
      },
    ];

    const groups = groupSellerOrders(orders, NOW);

    expect(groups.map((group) => [group.id, group.orders.map((order) => order.id)])).toEqual([
      // The late hand-over first, then decisions oldest first.
      ["seller", [5, 4, 3]],
      ["buyer", [2]],
      ["closed", [1]],
    ]);
    expect(groups[0].orders[0]).toMatchObject({ step: { kind: "ship" }, urgency: "overdue" });
  });

  it("keeps the seller's group even when nothing is waiting on them", () => {
    const groups = groupSellerOrders([{ ...base, ...facts({ status: "completed" }), id: 1, created_at: "2026-09-01T00:00:00.000Z" }], NOW);

    expect(groups.map((group) => [group.id, group.orders.length])).toEqual([
      ["seller", 0],
      ["closed", 1],
    ]);
  });
});
