import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SellerOrderDetailPage from "@/app/panel/pedidos/[id]/page";
import { sendMessage } from "@/lib/actions/messages";
import type { BuyerTrustOutput } from "@/lib/buyer-trust";
import { getBuyerTrustForOrder } from "@/lib/queries/buyer-trust.server";
import { fetchPickupPoint } from "@/lib/queries/checkout.server";
import { getOrderDetail, type OrderDetail } from "@/lib/queries/orders.server";

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("@/lib/queries/orders.server", () => ({ getOrderDetail: vi.fn() }));
vi.mock("@/lib/queries/buyer-trust.server", () => ({ getBuyerTrustForOrder: vi.fn() }));
vi.mock("@/lib/queries/checkout.server", () => ({ fetchPickupPoint: vi.fn() }));
vi.mock("@/lib/actions/messages", () => ({ sendMessage: vi.fn() }));
vi.mock("@/lib/actions/orders", () => ({ transitionOrder: vi.fn(), confirmOrderPayment: vi.fn(), cancelOrderAsSeller: vi.fn() }));
vi.mock("@/lib/actions/trust-evidence", () => ({ respondToDispute: vi.fn() }));
vi.mock("@/components/messages/message-thread", () => ({ MessageThread: () => null }));

const NOW = new Date("2026-08-21T12:00:00Z");

const marker = { primary_text: "Dato", tooltip: "Explicación.", signal: "Good" as const };
const trust: BuyerTrustOutput = {
  member_since: { primary_text: "Miembro desde enero de 2026", tooltip: "Antigüedad." },
  verification_level: { primary_text: "Comprador verificado", badge_label: "Verificado", tooltip: "Identidad revisada." },
  buyer_trust_tier: "Reliable",
  markers: {
    total_completed_purchases: marker,
    buyer_completion_rate: marker,
    claim_rate: marker,
    cancellation_rate: marker,
    payment_reliability: marker,
    average_time_to_close: marker,
    fast_closer_rate: marker,
    response_rate: marker,
    review_rate: marker,
    recent_activity: marker,
  },
  summary: "Comprador confiable.", reasons: [], next_tier_requirements: [],
};

const order: OrderDetail = {
  id: 41, buyer_id: "buyer", current_user_id: "seller", viewer_role: "seller",
  fulfillment_method: "shipping", alt_contact: null,
  status: "accepted", subtotal: 250, currency_code: "MXN", created_at: "2026-08-20T12:00:00Z",
  shop: { id: 2, name: "Casa Niebla", slug: "casa-niebla" }, buyer_note: null,
  handling_days: 2, handling_time_zone: "America/Mexico_City", payment_confirmation_required: true,
  payment_completed_at: null, seller_cancellation_reason: null, accepted_at: "2026-08-20T13:00:00Z",
  ship_by_at: "2026-08-24T13:00:00Z", shipped_at: null, delivered_at: null, completed_at: null,
  tracking_text: null, items: [], address: null, events: [], conversation: null, review: null, dispute: null,
};

async function renderOrder(overrides: Partial<OrderDetail> = {}, buyerTrust: BuyerTrustOutput | null = trust) {
  vi.mocked(getOrderDetail).mockResolvedValue({ ...order, ...overrides });
  vi.mocked(getBuyerTrustForOrder).mockResolvedValue(buyerTrust);
  render(await SellerOrderDetailPage({ params: Promise.resolve({ id: "41" }) }));
}

function precedes(first: Element, second: Element) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

describe("seller order buyer trust", () => {
  it("renders buyer standing and payment gate for seller", async () => {
    await renderOrder();
    expect(screen.getByRole("heading", { name: "Confiable · Cierra rápido" })).toBeInTheDocument();
    expect(screen.getByText("Pago: pendiente de confirmación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar pago" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como enviado" })).not.toBeInTheDocument();
    expect(fetchPickupPoint).not.toHaveBeenCalled();
  });

  it("fetches and renders the pickup point for a pickup order", async () => {
    vi.mocked(fetchPickupPoint).mockResolvedValue({
      locality: "Zapopan",
      administrative_area_code: "MX-JAL",
      address_line1: "Av. Vallarta 1234",
      postal_code: "45010",
    });

    await renderOrder({ fulfillment_method: "pickup" }, null);

    expect(fetchPickupPoint).toHaveBeenCalledWith(2);
    expect(screen.getByRole("heading", { name: "Recolección en tienda" })).toBeInTheDocument();
    expect(screen.getByText("Av. Vallarta 1234")).toBeInTheDocument();
  });

  it("rejects buyer viewers on seller route", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({ ...order, current_user_id: "buyer", viewer_role: "buyer" });
    vi.mocked(getBuyerTrustForOrder).mockResolvedValue(null);
    await expect(SellerOrderDetailPage({ params: Promise.resolve({ id: "41" }) })).rejects.toThrow("NOT_FOUND");
  });
});

describe("seller order next step", () => {
  it("puts what the buyer waits for, and the buttons to answer it, before the buyer's trust record", async () => {
    await renderOrder();

    const next = screen.getByRole("region", { name: "El comprador espera tus indicaciones de pago" });
    const trustHeading = screen.getByRole("heading", { name: "Confiable · Cierra rápido" });
    expect(within(next).getByRole("button", { name: "Confirmar pago" })).toBeInTheDocument();
    expect(precedes(next, trustHeading)).toBe(true);
    expect(within(next).getByText(/fuera de la plaza/)).toBeInTheDocument();
  });

  it("gives the promised date in words and in the shop's time zone, never as a raw timestamp", async () => {
    await renderOrder();

    const next = screen.getByRole("region", { name: "El comprador espera tus indicaciones de pago" });
    const deadline = within(next).getByText(/^Fecha comprometida para enviar: 24 de agosto a las 7:00\sa\.\sm\.$|^Fecha comprometida para enviar: 24 de agosto a las 7:00\sa\.m\.$/);
    expect(deadline).toHaveAttribute("datetime", "2026-08-24T13:00:00Z");
    expect(document.body.textContent).not.toContain("2026-08-24T13:00:00Z");
  });

  it("says in words when the promised date has passed", async () => {
    vi.setSystemTime(new Date("2026-08-25T12:00:00Z"));
    await renderOrder({ payment_completed_at: "2026-08-21T15:00:00Z" });

    const next = screen.getByRole("region", { name: "El comprador espera su envío" });
    expect(within(next).getByText(/^La fecha comprometida para enviar ya pasó: /)).toBeInTheDocument();
    expect(within(next).getByText("Plazo vencido")).toBeInTheDocument();
    expect(within(next).getByRole("button", { name: "Marcar como enviado" })).toBeInTheDocument();
  });

  it("asks for a hand-over, not a shipment, on a collected order", async () => {
    vi.mocked(fetchPickupPoint).mockResolvedValue(null);

    await renderOrder({ fulfillment_method: "pickup", payment_completed_at: "2026-08-20T15:00:00Z" });

    const next = screen.getByRole("region", { name: "El comprador espera recoger su pedido" });
    expect(within(next).getByText(/^Fecha comprometida para entregar: /)).toBeInTheDocument();
    expect(within(next).getByRole("button", { name: "Marcar como entregado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como enviado" })).not.toBeInTheDocument();
  });

  it("tells the seller when the next move is the buyer's", async () => {
    await renderOrder({ status: "shipped", payment_completed_at: "2026-08-20T15:00:00Z" });

    expect(screen.getByRole("region", { name: "El comprador debe confirmar que lo recibió" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar|Confirmar|Aceptar|Rechazar|Cancelar/ })).not.toBeInTheDocument();
  });

  it("says a closed order needs nothing more", async () => {
    await renderOrder({ status: "canceled_by_buyer" }, null);

    const next = screen.getByRole("region", { name: "Pedido cerrado" });
    expect(within(next).getByText(/No hay nada pendiente/)).toBeInTheDocument();
  });

  it("refreshes the seller's queue when they reply from the order", async () => {
    // The page binds the action to its thread and the pages a reply refreshes.
    const bind = vi.spyOn(sendMessage as unknown as { bind: (...args: unknown[]) => unknown }, "bind");

    await renderOrder({ conversation: { id: 9, messages: [] } });

    expect(bind).toHaveBeenCalledWith(null, 9, expect.arrayContaining(["/panel", "/panel/pedidos/41", "/mensajes"]));
  });
});
