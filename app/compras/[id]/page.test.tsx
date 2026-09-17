import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PurchaseDetailPage from "@/app/compras/[id]/page";
import { fetchPickupPoint } from "@/lib/queries/checkout.server";
import { getOrderDetail, type OrderDetail } from "@/lib/queries/orders.server";
import { requireSignedIn } from "@/lib/require-signed-in.server";

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("@/lib/queries/orders.server", () => ({ getOrderDetail: vi.fn() }));
vi.mock("@/lib/require-signed-in.server", () => ({ requireSignedIn: vi.fn() }));
vi.mock("@/lib/queries/checkout.server", () => ({ fetchPickupPoint: vi.fn() }));
vi.mock("@/lib/actions/messages", () => ({ sendMessage: vi.fn() }));
vi.mock("@/lib/actions/orders", () => ({ transitionOrder: vi.fn(), cancelOrderAsBuyer: vi.fn() }));
vi.mock("@/lib/actions/trust-evidence", () => ({ createReview: vi.fn(), openDispute: vi.fn() }));

const order: OrderDetail = {
  id: 41,
  buyer_id: "buyer",
  current_user_id: "buyer",
  viewer_role: "buyer",
  fulfillment_method: "shipping",
  alt_contact: null,
  status: "requested",
  subtotal: 250,
  currency_code: "MXN",
  created_at: "2026-08-20T12:00:00Z",
  shop: { id: 2, name: "Casa Niebla", slug: "casa-niebla" },
  buyer_note: null,
  handling_days: 2,
  handling_time_zone: "America/Mexico_City",
  payment_confirmation_required: true,
  payment_completed_at: null,
  seller_cancellation_reason: null,
  accepted_at: null,
  ship_by_at: null,
  shipped_at: null,
  delivered_at: null,
  completed_at: null,
  tracking_text: null,
  items: [],
  address: null,
  events: [],
  conversation: null,
  review: null,
  dispute: null,
};

afterEach(() => { vi.useRealTimers(); cleanup(); vi.clearAllMocks(); });

// clearAllMocks drops recorded calls but keeps implementations, so a test that
// makes the guard reject would otherwise turn every later test into a redirect.
beforeEach(() => { vi.mocked(requireSignedIn).mockResolvedValue("buyer"); });

describe("reaching one purchase", () => {
  it("asks a signed-out visitor to sign in and come back to this order", async () => {
    vi.mocked(requireSignedIn).mockRejectedValueOnce(new Error("NEXT_REDIRECT:/ingresar?continuar=/compras/41"));

    await expect(
      PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/ingresar?continuar=/compras/41");
  });

  it("still hides an order that is not theirs behind a 404", async () => {
    // Signed in is not the same as entitled. A missing row stays a 404 so the
    // page never confirms that somebody else's order number exists.
    vi.mocked(getOrderDetail).mockResolvedValue(null);

    await expect(
      PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("buyer order fulfillment", () => {
  it("does not fetch a pickup point for a shipped order", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(order);

    render(await PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }));

    expect(screen.getByRole("heading", { name: "Envío a domicilio" })).toBeInTheDocument();
    expect(fetchPickupPoint).not.toHaveBeenCalled();
  });

  it("fetches and renders the pickup point for a pickup order", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({ ...order, fulfillment_method: "pickup" });
    vi.mocked(fetchPickupPoint).mockResolvedValue({
      locality: "Zapopan",
      administrative_area_code: "MX-JAL",
    });

    render(await PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }));

    expect(fetchPickupPoint).toHaveBeenCalledWith(2);
    expect(screen.getByRole("heading", { name: "Recolección en tienda" })).toBeInTheDocument();
    expect(
      screen.getByText("Verás la dirección completa cuando el vendedor acepte tu pedido."),
    ).toBeInTheDocument();
  });
});

describe("the order timeline", () => {
  it("names each step in words rather than column values", async () => {
    // "Historial" used to print event_type straight from the database, so a
    // buyer read "auto_completed" and "admin_repair" in their own order.
    vi.mocked(getOrderDetail).mockResolvedValue({
      ...order,
      events: [
        { id: 1, event_type: "requested", previous_status: null, next_status: "requested", created_at: "2026-08-20T12:00:00Z" },
        { id: 2, event_type: "shipped", previous_status: "accepted", next_status: "shipped", created_at: "2026-08-22T12:00:00Z" },
        { id: 3, event_type: "auto_completed", previous_status: "delivered", next_status: "completed", created_at: "2026-08-30T12:00:00Z" },
      ],
    });

    render(await PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }));

    // Scoped to the timeline: the order's own status line carries some of the
    // same words, and matching page-wide would pass without the list changing.
    const timeline = within(screen.getByText("Historial").closest("div") as HTMLElement);

    expect(timeline.getByText("Solicitud enviada")).toBeInTheDocument();
    expect(timeline.getByText("Enviado")).toBeInTheDocument();
    expect(timeline.getByText("Completada automáticamente")).toBeInTheDocument();
    expect(screen.queryByText("auto_completed")).not.toBeInTheDocument();
  });

  it("keeps an unrecognised event readable", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({
      ...order,
      events: [
        { id: 1, event_type: "something_new", previous_status: null, next_status: "requested", created_at: "2026-08-20T12:00:00Z" },
      ],
    });

    render(await PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }));

    expect(screen.getByText("Actualización del pedido")).toBeInTheDocument();
    expect(screen.queryByText("something_new")).not.toBeInTheDocument();
  });
});

describe("a disputed order", () => {
  it("names the dispute state in words", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({
      ...order,
      status: "delivered",
      dispute: {
        id: 5,
        reason: "item_not_as_described",
        status: "seller_responded",
        buyer_statement: "Llegó con una grieta.",
        seller_response: null,
        resolution: null,
        resolution_notes: null,
        seller_fault: null,
        opened_at: "2026-08-25T12:00:00Z",
      },
    });

    render(await PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }));

    expect(screen.getByRole("heading", { name: "Disputa con respuesta de la tienda" })).toBeInTheDocument();
  });
});

describe("what the buyer is waiting for", () => {
  function precedes(first: Element, second: Element) {
    return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  it("leads with the buyer's waiting status and their own buttons", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(order);

    render(await PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }));

    const status = screen.getByRole("region", { name: "La tienda está revisando tu solicitud" });
    expect(within(status).getByText(/no tiene un plazo fijo/)).toBeInTheDocument();
    expect(within(status).getByRole("button", { name: "Cancelar pedido" })).toBeInTheDocument();
    expect(precedes(status, screen.getByRole("heading", { name: "Productos" }))).toBe(true);
  });

  it("gives the shop's promise in words and in its time zone, never as a raw timestamp", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-21T12:00:00Z"));
    vi.mocked(getOrderDetail).mockResolvedValue({
      ...order,
      status: "accepted",
      accepted_at: "2026-08-20T13:00:00Z",
      payment_completed_at: "2026-08-20T15:00:00Z",
      ship_by_at: "2026-08-24T13:00:00Z",
    });

    render(await PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }));

    const status = screen.getByRole("region", { name: "La tienda prepara tu envío" });
    const promise = within(status).getByText(/^La tienda se comprometió a enviarlo antes del 24 de agosto a las 7:00\sa\.\s?m\.$/);
    expect(promise).toHaveAttribute("datetime", "2026-08-24T13:00:00Z");
    expect(document.body.textContent).not.toContain("2026-08-24T13:00:00Z");
  });

  it("names a collected order's hand-over in its status and timeline", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({
      ...order,
      fulfillment_method: "pickup",
      status: "shipped",
      payment_completed_at: "2026-08-20T15:00:00Z",
      events: [{ id: 2, event_type: "shipped", previous_status: "accepted", next_status: "shipped", created_at: "2026-08-22T12:00:00Z" }],
    });

    render(await PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }));

    const status = screen.getByRole("region", { name: "La tienda marcó tu pedido como entregado" });
    expect(within(status).getByRole("button", { name: "Confirmar recepción" })).toBeInTheDocument();
    const timeline = within(screen.getByText("Historial").closest("div") as HTMLElement);
    expect(timeline.getByText("Entregado por la tienda")).toBeInTheDocument();
    expect(screen.queryByText("Enviado")).not.toBeInTheDocument();
  });

  it("is honest that nothing is sent by email or notification", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(order);

    render(await PurchaseDetailPage({ params: Promise.resolve({ id: "41" }) }));

    expect(screen.getByText(/Aún no enviamos avisos por correo ni notificaciones/)).toBeInTheDocument();
  });
});
