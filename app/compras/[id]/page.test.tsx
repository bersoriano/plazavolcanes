import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PurchaseDetailPage from "@/app/compras/[id]/page";
import { fetchPickupPoint } from "@/lib/queries/checkout.server";
import { getOrderDetail, type OrderDetail } from "@/lib/queries/orders.server";

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("@/lib/queries/orders.server", () => ({ getOrderDetail: vi.fn() }));
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

afterEach(() => { cleanup(); vi.clearAllMocks(); });

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
