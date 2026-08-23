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
