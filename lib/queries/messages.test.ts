import { expect, test } from "vitest";

import { mapConversationRows, oldestFirst, type ConversationRow } from "@/lib/queries/messages";

const row: ConversationRow = {
  conversation_id: 7,
  type: "pre_sale",
  order_id: null,
  shop_id: 3,
  shop_name: "Tienda Prueba",
  shop_slug: "tienda-prueba",
  counterpart_label: "Ana Ruiz",
  product_id: null,
  product_name: null,
  product_slug: null,
  product_image_path: null,
  product_price: null,
  product_currency_code: null,
  product_status: null,
  product_units_available: null,
  last_message_body: "Hola",
  last_message_at: "2026-08-23T10:00:00Z",
  last_message_sender_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  unread_count: 2,
};

test("carries the row through with its unread count", () => {
  const [summary] = mapConversationRows([row]);

  expect(summary.id).toBe(7);
  expect(summary.unread_count).toBe(2);
  expect(summary.counterpart_label).toBe("Ana Ruiz");
});

test("represents a thread nobody has written in yet", () => {
  const [summary] = mapConversationRows([
    { ...row, last_message_body: null, last_message_at: null, last_message_sender_id: null },
  ]);

  expect(summary.last_message).toBeNull();
});

test("keeps an order thread's link back to its order", () => {
  const [summary] = mapConversationRows([{ ...row, type: "order", order_id: 12 }]);

  expect(summary.order_id).toBe(12);
});

test("sorts messages oldest first", () => {
  const sorted = oldestFirst([
    { id: 2, created_at: "2026-08-23T11:00:00Z" },
    { id: 1, created_at: "2026-08-23T10:00:00Z" },
  ]);

  expect(sorted.map((entry) => entry.id)).toEqual([1, 2]);
});

test("does not mutate the array it was given", () => {
  const messages = [
    { id: 2, created_at: "2026-08-23T11:00:00Z" },
    { id: 1, created_at: "2026-08-23T10:00:00Z" },
  ];
  oldestFirst(messages);

  expect(messages.map((entry) => entry.id)).toEqual([2, 1]);
});

const productRow: ConversationRow = {
  ...row,
  product_id: 12,
  product_name: "Taza de barro",
  product_slug: "taza-de-barro",
  product_image_path: "tienda/taza.jpg",
  product_price: 250,
  product_currency_code: "MXN",
  product_status: "published",
  product_units_available: 3,
};

test("carries the listing a product thread is about", () => {
  const [summary] = mapConversationRows([productRow]);

  expect(summary.product).toMatchObject({
    id: 12,
    name: "Taza de barro",
    price: 250,
    currency_code: "MXN",
    is_available: true,
    href: "/productos/taza-de-barro",
  });
});

test("leaves a general enquiry without a product", () => {
  const [summary] = mapConversationRows([row]);

  expect(summary.product).toBeNull();
});

test("never reads an order thread as a product enquiry", () => {
  const [summary] = mapConversationRows([{ ...productRow, type: "order", order_id: 12 }]);

  expect(summary.product).toBeNull();
});

test("marks a listing that sold out as no longer available", () => {
  const [summary] = mapConversationRows([{ ...productRow, product_units_available: 0 }]);

  expect(summary.product?.is_available).toBe(false);
  // The page is still there while the listing is published, so the link stays.
  expect(summary.product?.href).toBe("/productos/taza-de-barro");
});

test("drops the link once the listing leaves the plaza", () => {
  const [summary] = mapConversationRows([{ ...productRow, product_status: "deleted" }]);

  expect(summary.product?.is_available).toBe(false);
  expect(summary.product?.href).toBeNull();
  expect(summary.product?.name).toBe("Taza de barro");
});

test("shows a price the seller changed after the thread began", () => {
  const [summary] = mapConversationRows([{ ...productRow, product_price: 275 }]);

  expect(summary.product?.price).toBe(275);
});
