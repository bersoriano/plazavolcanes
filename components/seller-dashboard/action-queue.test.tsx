import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ActionQueue } from "@/components/seller-dashboard/action-queue";
import { buildSellerDashboard, type DashboardOrder, type SellerDashboardInput } from "@/lib/seller-dashboard";

const NOW = new Date("2026-09-15T12:00:00.000Z");

function hoursAgo(hours: number) {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

function order(overrides: Partial<DashboardOrder>): DashboardOrder {
  return {
    id: 50,
    shop_id: 1,
    status: "requested",
    created_at: hoursAgo(5),
    accepted_at: null,
    ship_by_at: null,
    payment_confirmation_required: true,
    payment_completed_at: null,
    fulfillment_method: "shipping",
    handling_time_zone: "America/Mexico_City",
    item_names: ["Taza Ceniza"],
    ...overrides,
  };
}

function dashboard(overrides: Partial<SellerDashboardInput> = {}) {
  return buildSellerDashboard({
    userId: "seller-1",
    now: NOW,
    shopLimit: 1,
    shops: [
      {
        id: 1,
        name: "Casa Niebla",
        slug: "casa-niebla",
        image_path: null,
        delivery_policy: "Entrega en Cholula.",
        is_publishing_approved: true,
        publishing_reviewed_at: "2026-08-01T00:00:00.000Z",
        listing_limit: 10,
        is_premium: false,
        trust_tier: "standard",
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ],
    products: { ok: true, value: [] },
    conversations: { ok: true, value: [] },
    openOrders: { ok: true, value: [] },
    replyClocks: { ok: true, value: [] },
    hasCompletedSale: { ok: true, value: false },
    hasAnsweredBuyer: { ok: true, value: false },
    metrics: { ok: true, value: { inquiries: [], purchaseRequests: [], completedOrders: [] } },
    requestedFocusShopId: null,
    ...overrides,
  });
}

function renderQueue(overrides: Partial<SellerDashboardInput> = {}) {
  const state = dashboard(overrides);
  render(<ActionQueue groups={state.attentionGroups} now={NOW} total={state.attention.length} unavailable={state.unavailable} />);
  return screen.getByRole("region", { name: "Requiere tu atención" });
}

afterEach(cleanup);

describe("ActionQueue", () => {
  it("groups work under headings that carry their counts", () => {
    const queue = renderQueue({
      openOrders: {
        ok: true,
        value: [
          order({ id: 51 }),
          order({ id: 52, created_at: hoursAgo(9) }),
          order({ id: 53, status: "accepted", accepted_at: hoursAgo(3), payment_completed_at: hoursAgo(1), ship_by_at: hoursAgo(2) }),
        ],
      },
      conversations: {
        ok: true,
        value: [{ id: 70, type: "pre_sale", order_id: null, shop_id: 1, product_name: "Jarra", last_message: { created_at: hoursAgo(3), sender_id: "buyer-1" } }],
      },
    });

    expect(within(queue).getByText("4 pendientes")).toBeInTheDocument();
    const groups = within(queue).getAllByRole("region");
    expect(groups.map((group) => group.getAttribute("aria-labelledby"))).toEqual(["attention-decide", "attention-reply", "attention-fulfil"]);
    const decide = within(queue).getByRole("region", { name: "Solicitudes por decidir, 2 pendientes" });
    expect(within(decide).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/panel/pedidos/52", "/panel/pedidos/51"]);
    expect(within(queue).getByRole("region", { name: "Compradores esperando respuesta, 1 pendiente" })).toBeInTheDocument();
  });

  it("states a passed deadline in words, not only in colour", () => {
    const queue = renderQueue({
      openOrders: {
        ok: true,
        value: [order({ id: 53, status: "accepted", accepted_at: hoursAgo(30), payment_completed_at: hoursAgo(1), ship_by_at: hoursAgo(2) })],
      },
    });

    const link = within(queue).getByRole("link", { name: /Taza Ceniza/ });
    expect(link).toHaveAttribute("href", "/panel/pedidos/53");
    expect(within(link).getByText("Plazo vencido")).toBeInTheDocument();
    expect(within(link).getByText(/^La fecha para enviar ya pasó/)).toHaveAttribute("datetime", hoursAgo(2));
    expect(within(link).getByText("Envío · Casa Niebla")).toBeInTheDocument();
    expect(within(link).getByText("Ver pedido")).toBeInTheDocument();
  });

  it("names a collected order's hand-over without shipping words", () => {
    const queue = renderQueue({
      openOrders: {
        ok: true,
        value: [order({ id: 54, status: "accepted", fulfillment_method: "pickup", accepted_at: hoursAgo(20), payment_completed_at: hoursAgo(1), ship_by_at: hoursAgo(-6) })],
      },
    });

    const fulfil = within(queue).getByRole("region", { name: "Pedidos por entregar, 1 pendiente" });
    const link = within(fulfil).getByRole("link", { name: /Taza Ceniza/ });
    expect(within(link).getByText("Entrega · Casa Niebla")).toBeInTheDocument();
    expect(within(link).getByText("Vence pronto")).toBeInTheDocument();
    expect(within(link).getByText(/^Entrega antes del /)).toHaveAttribute("datetime", hoursAgo(-6));
    expect(link.textContent).not.toMatch(/env[ií]/i);
  });

  it("counts down an order thread's 24-hour reply window", () => {
    const queue = renderQueue({
      openOrders: { ok: true, value: [order({ id: 50, status: "shipped", payment_completed_at: hoursAgo(30) })] },
      conversations: {
        ok: true,
        value: [{ id: 72, type: "order", order_id: 50, shop_id: 1, product_name: null, last_message: { created_at: hoursAgo(1), sender_id: "buyer-1" } }],
      },
      replyClocks: { ok: true, value: [{ conversation_id: 72, clock_started_at: hoursAgo(20) }] },
    });

    const link = within(queue).getByRole("link", { name: /Mensaje sobre el pedido #50/ });
    expect(link).toHaveAttribute("href", "/mensajes/72");
    expect(within(link).getByText("Sin respuesta desde hace 20 h")).toBeInTheDocument();
    expect(within(link).getByText("Responde en las próximas 4 h")).toHaveAttribute("datetime", hoursAgo(-4));
    expect(within(link).getByText("Vence pronto")).toBeInTheDocument();
    expect(within(link).getByText("Responder")).toBeInTheDocument();
  });

  it("says plainly when nothing is waiting", () => {
    const queue = renderQueue();

    expect(within(queue).getByText("Nada pendiente por ahora.")).toBeInTheDocument();
    expect(within(queue).queryByRole("list")).not.toBeInTheDocument();
  });

  it("does not claim an empty queue when a source failed", () => {
    const queue = renderQueue({ openOrders: { ok: false } });

    expect(within(queue).getByRole("status")).toHaveTextContent("esta lista puede estar incompleta");
    expect(within(queue).queryByText("Nada pendiente por ahora.")).not.toBeInTheDocument();
  });

  it("explains threads listed without their reply window", () => {
    const queue = renderQueue({
      conversations: {
        ok: true,
        value: [{ id: 70, type: "pre_sale", order_id: null, shop_id: 1, product_name: "Jarra", last_message: { created_at: hoursAgo(3), sender_id: "buyer-1" } }],
      },
      replyClocks: { ok: false },
    });

    expect(within(queue).getByRole("status")).toHaveTextContent("No pudimos revisar los plazos de respuesta");
  });

  it("is honest that nothing is pushed to the seller", () => {
    const queue = renderQueue();

    expect(within(queue).getByText(/Aún no enviamos avisos por correo ni notificaciones/)).toBeInTheDocument();
  });
});
