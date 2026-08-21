import { describe, expect, it } from "vitest";

import { mapOrderDetailRow, type OrderDetailRow } from "@/lib/queries/orders";

/**
 * PostgREST returns a to-one embed as an object, or null when the row is absent.
 * order_addresses, conversations, order_reviews and order_disputes are all to-one,
 * because order_id is a primary key or unique on each of them.
 */
function row(overrides: Partial<OrderDetailRow> = {}): OrderDetailRow {
  return {
    id: 1,
    buyer_id: "buyer-uuid",
    status: "requested",
    subtotal: 500,
    currency_code: "MXN",
    buyer_note: null,
    handling_days: 3,
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
    created_at: "2026-08-21T00:00:00.000Z",
    shops: { id: 7, name: "Tienda Pedido", slug: "tienda-pedido" },
    order_items: [
      { id: 1, product_name: "Producto pedido", unit_price: 250, quantity: 2, line_total: 500 },
    ],
    order_addresses: {
      recipient: "Ana Ruiz",
      address_line1: "Calle Volcán 12",
      address_line2: null,
      locality: "Guadalajara",
      administrative_area: "Jalisco",
      postal_code: "44100",
      country_code: "MX",
      delivery_instructions: null,
      redacted_at: null,
    },
    order_events: [
      { id: 2, event_type: "requested", previous_status: null, next_status: "requested", created_at: "2026-08-21T00:00:01.000Z" },
      { id: 1, event_type: "created", previous_status: null, next_status: "requested", created_at: "2026-08-21T00:00:00.000Z" },
    ],
    conversations: {
      id: 3,
      messages: [
        { id: 2, sender_id: "buyer-uuid", body: "segundo", created_at: "2026-08-21T00:10:00.000Z" },
        { id: 1, sender_id: "seller-uuid", body: "primero", created_at: "2026-08-21T00:05:00.000Z" },
      ],
    },
    order_reviews: null,
    order_disputes: null,
    ...overrides,
  };
}

describe("mapOrderDetailRow", () => {
  it("keeps the delivery address of a fresh order", () => {
    expect(mapOrderDetailRow(row(), "buyer-uuid")?.address?.recipient).toBe("Ana Ruiz");
  });

  it("keeps the conversation and orders its messages oldest first", () => {
    const detail = mapOrderDetailRow(row(), "buyer-uuid");

    expect(detail?.conversation?.id).toBe(3);
    expect(detail?.conversation?.messages.map((message) => message.body)).toEqual([
      "primero",
      "segundo",
    ]);
  });

  it("reads an order with no review and no dispute", () => {
    const detail = mapOrderDetailRow(row(), "buyer-uuid");

    expect(detail?.review).toBeNull();
    expect(detail?.dispute).toBeNull();
  });

  it("reads an order that has no conversation or address yet", () => {
    const detail = mapOrderDetailRow(
      row({ conversations: null, order_addresses: null }),
      "buyer-uuid",
    );

    expect(detail?.conversation).toBeNull();
    expect(detail?.address).toBeNull();
  });

  it("surfaces a review and a dispute once they exist", () => {
    const detail = mapOrderDetailRow(
      row({
        order_reviews: { id: 9, rating: 5, matched_description: true, comment: null, created_at: "2026-08-22T00:00:00.000Z" },
        order_disputes: { id: 4, reason: "not_as_described", status: "open", buyer_statement: "No coincide.", seller_response: null, resolution: null, resolution_notes: null, seller_fault: null, opened_at: "2026-08-22T00:00:00.000Z" },
      }),
      "buyer-uuid",
    );

    expect(detail?.review?.rating).toBe(5);
    expect(detail?.dispute?.status).toBe("open");
  });

  it("sorts events oldest first and names the viewer role", () => {
    expect(mapOrderDetailRow(row(), "buyer-uuid")?.events.map((event) => event.id)).toEqual([1, 2]);
    expect(mapOrderDetailRow(row(), "buyer-uuid")?.viewer_role).toBe("buyer");
    expect(mapOrderDetailRow(row(), "seller-uuid")?.viewer_role).toBe("seller");
  });
});
