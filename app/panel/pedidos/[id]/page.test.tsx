import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SellerOrderDetailPage from "@/app/panel/pedidos/[id]/page";
import type { BuyerTrustOutput } from "@/lib/buyer-trust";
import { getBuyerTrustForOrder } from "@/lib/queries/buyer-trust.server";
import { getOrderDetail, type OrderDetail } from "@/lib/queries/orders.server";

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("@/lib/queries/orders.server", () => ({ getOrderDetail: vi.fn() }));
vi.mock("@/lib/queries/buyer-trust.server", () => ({ getBuyerTrustForOrder: vi.fn() }));
vi.mock("@/lib/actions/messages", () => ({ sendMessage: vi.fn() }));
vi.mock("@/lib/actions/orders", () => ({ transitionOrder: vi.fn(), confirmOrderPayment: vi.fn(), cancelOrderAsSeller: vi.fn() }));
vi.mock("@/lib/actions/trust-evidence", () => ({ respondToDispute: vi.fn() }));

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
  status: "accepted", subtotal: 250, currency_code: "MXN", created_at: "2026-08-20T12:00:00Z",
  shop: { id: 2, name: "Casa Niebla", slug: "casa-niebla" }, buyer_note: null,
  handling_days: 2, handling_time_zone: "America/Mexico_City", payment_confirmation_required: true,
  payment_completed_at: null, seller_cancellation_reason: null, accepted_at: "2026-08-20T13:00:00Z",
  ship_by_at: "2026-08-24T13:00:00Z", shipped_at: null, delivered_at: null, completed_at: null,
  tracking_text: null, items: [], address: null, events: [], conversation: null, review: null, dispute: null,
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("seller order buyer trust", () => {
  it("renders buyer standing and payment gate for seller", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(order);
    vi.mocked(getBuyerTrustForOrder).mockResolvedValue(trust);
    render(await SellerOrderDetailPage({ params: Promise.resolve({ id: "41" }) }));
    expect(screen.getByRole("heading", { name: "Confiable · Cierra rápido" })).toBeInTheDocument();
    expect(screen.getByText("Pago: pendiente de confirmación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar pago" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como enviado" })).not.toBeInTheDocument();
  });

  it("rejects buyer viewers on seller route", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({ ...order, current_user_id: "buyer", viewer_role: "buyer" });
    vi.mocked(getBuyerTrustForOrder).mockResolvedValue(null);
    await expect(SellerOrderDetailPage({ params: Promise.resolve({ id: "41" }) })).rejects.toThrow("NOT_FOUND");
  });
});
