import { expect, test } from "vitest";

import type { PlatformNotice } from "@/lib/queries/platform-notices";
import {
  filterInbox,
  mapConversationRows,
  mergeInbox,
  oldestFirst,
  orderItemLabel,
  startedConversations,
  unreadTotals,
  type ConversationRow,
} from "@/lib/queries/messages";

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
  product_is_public: null,
  product_units_available: null,
  last_message_body: "Hola",
  last_message_at: "2026-08-23T10:00:00Z",
  last_message_sender_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  unread_count: 2,
  order_item_name: null,
  order_item_image_path: null,
  order_item_count: null,
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
  product_is_public: true,
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
  const [summary] = mapConversationRows([
    { ...productRow, product_status: "deleted", product_is_public: false },
  ]);

  expect(summary.product?.is_available).toBe(false);
  expect(summary.product?.href).toBeNull();
  expect(summary.product?.name).toBe("Taza de barro");
});

test("keeps a moderated listing readable without exposing its public link", () => {
  const [summary] = mapConversationRows([
    { ...productRow, product_is_public: false },
  ]);

  expect(summary.product?.name).toBe("Taza de barro");
  expect(summary.product?.is_available).toBe(false);
  expect(summary.product?.href).toBeNull();
});

test("shows a price the seller changed after the thread began", () => {
  const [summary] = mapConversationRows([{ ...productRow, product_price: 275 }]);

  expect(summary.product?.price).toBe(275);
});

test("keeps out of the inbox a thread nobody has written in", () => {
  // An order opens a conversation whether or not anyone speaks. The inbox lists
  // conversations, so an order still waiting for its first word stays out of it.
  const silentOrder = mapConversationRows([
    {
      ...row,
      conversation_id: 9,
      type: "order",
      order_id: 12,
      last_message_body: null,
      last_message_at: null,
      last_message_sender_id: null,
      unread_count: 0,
    },
  ]);

  expect(startedConversations(silentOrder)).toEqual([]);
});

test("keeps an order thread once it carries a message", () => {
  const spokenOrder = mapConversationRows([
    { ...row, conversation_id: 9, type: "order", order_id: 12 },
  ]);

  expect(startedConversations(spokenOrder).map((entry) => entry.id)).toEqual([9]);
});

test("leaves the threads that have messages in the order they arrived", () => {
  const conversations = mapConversationRows([
    row,
    { ...row, conversation_id: 8, last_message_body: null, last_message_at: null, last_message_sender_id: null },
    { ...row, conversation_id: 9 },
  ]);

  expect(startedConversations(conversations).map((entry) => entry.id)).toEqual([7, 9]);
});

const orderRow: ConversationRow = {
  ...row,
  conversation_id: 9,
  type: "order",
  order_id: 41,
  order_item_name: "Reloj de cuerda",
  order_item_image_path: "tienda/reloj.jpg",
  order_item_count: 3,
};

test("carries what an order thread's order holds", () => {
  const [summary] = mapConversationRows(
    [orderRow],
    new Map([["tienda/reloj.jpg", "https://cdn.test/reloj.jpg"]]),
  );

  expect(summary.order_item).toEqual({
    name: "Reloj de cuerda",
    image_url: "https://cdn.test/reloj.jpg",
    more: 2,
  });
});

test("keeps the name of an order line whose listing is gone", () => {
  const [summary] = mapConversationRows([
    { ...orderRow, order_item_image_path: null, order_item_count: 1 },
  ]);

  expect(summary.order_item).toEqual({ name: "Reloj de cuerda", image_url: null, more: 0 });
});

test("leaves a thread that is not about an order without an order line", () => {
  const [summary] = mapConversationRows([row]);

  expect(summary.order_item).toBeNull();
});

const at = (hour: number) => ({
  last_message_body: "Hola",
  last_message_at: `2026-08-23T${String(hour).padStart(2, "0")}:00:00+00:00`,
  last_message_sender_id: "them",
});

test("merges buying and selling threads, newest first, each with its role", () => {
  const buying = mapConversationRows([
    { ...row, conversation_id: 1, ...at(9) },
    { ...row, conversation_id: 2, ...at(15) },
  ]);
  const selling = mapConversationRows([{ ...row, conversation_id: 3, ...at(12) }]);

  expect(mergeInbox(buying, selling).map((entry) => [entry.id, entry.role])).toEqual([
    [2, "buyer"],
    [3, "seller"],
    [1, "buyer"],
  ]);
});

test("orders threads by instant, whatever precision the timestamps carry", () => {
  const buying = mapConversationRows([
    { ...row, conversation_id: 1, ...at(9), last_message_at: "2026-08-23T09:00:00.5+00:00" },
    { ...row, conversation_id: 2, ...at(9), last_message_at: "2026-08-23T09:00:00.123456+00:00" },
  ]);

  expect(mergeInbox(buying, []).map((entry) => entry.id)).toEqual([1, 2]);
});

test("leaves a silent order out of the merged inbox", () => {
  const selling = mapConversationRows([
    { ...orderRow, last_message_body: null, last_message_at: null, last_message_sender_id: null },
    { ...row, conversation_id: 3 },
  ]);

  expect(mergeInbox([], selling).map((entry) => entry.id)).toEqual([3]);
});

test("lists a thread once even if both sides return it", () => {
  const both = mapConversationRows([row]);

  expect(mergeInbox(both, both)).toHaveLength(1);
});

const inbox = mergeInbox(
  mapConversationRows([
    {
      ...productRow,
      conversation_id: 1,
      counterpart_label: "Casa Niebla",
      shop_name: "Casa Niebla",
      unread_count: 0,
      ...at(9),
      last_message_body: "Gracias por la atención",
    },
    { ...orderRow, conversation_id: 2, counterpart_label: "Taller Volcán", unread_count: 1, ...at(8) },
  ]),
  mapConversationRows([
    { ...row, conversation_id: 3, counterpart_label: "José Peña", unread_count: 4, ...at(7) },
  ]),
);

test("filters the inbox by side and by unread", () => {
  expect(filterInbox(inbox, "all").map((entry) => entry.id)).toEqual([1, 2, 3]);
  expect(filterInbox(inbox, "buying").map((entry) => entry.id)).toEqual([1, 2]);
  expect(filterInbox(inbox, "selling").map((entry) => entry.id)).toEqual([3]);
  expect(filterInbox(inbox, "unread").map((entry) => entry.id)).toEqual([2, 3]);
});

test("searches people, products, order lines, order numbers and the last message", () => {
  expect(filterInbox(inbox, "all", "niebla").map((entry) => entry.id)).toEqual([1]);
  expect(filterInbox(inbox, "all", "taza").map((entry) => entry.id)).toEqual([1]);
  expect(filterInbox(inbox, "all", "reloj").map((entry) => entry.id)).toEqual([2]);
  expect(filterInbox(inbox, "all", "pedido 41").map((entry) => entry.id)).toEqual([2]);
  expect(filterInbox(inbox, "all", "#41").map((entry) => entry.id)).toEqual([2]);
  expect(filterInbox(inbox, "all", "gracias").map((entry) => entry.id)).toEqual([1]);
});

test("searches without minding accents, capitals or stray spaces", () => {
  expect(filterInbox(inbox, "all", "  JOSE pena ").map((entry) => entry.id)).toEqual([3]);
  expect(filterInbox(inbox, "all", "atencion").map((entry) => entry.id)).toEqual([1]);
});

test("searches inside the chosen filter", () => {
  expect(filterInbox(inbox, "selling", "niebla")).toEqual([]);
});

test("adds up unread messages for each side", () => {
  expect(unreadTotals(inbox)).toEqual({ all: 5, buying: 1, selling: 4, platform: 0 });
});

test("keeps the open thread under unread while it is being read", () => {
  // Opening a thread reads it. Dropping it from the list that very moment would
  // pull the row out from under the reader.
  const read = inbox.map((entry) => (entry.id === 2 ? { ...entry, unread_count: 0 } : entry));

  expect(filterInbox(read, "unread", "", "c-2").map((entry) => entry.id)).toEqual([2, 3]);
  expect(filterInbox(read, "unread").map((entry) => entry.id)).toEqual([3]);
});

test("names an order by its first line and how many came with it", () => {
  expect(orderItemLabel({ name: "Reloj de cuerda", image_url: null, more: 2 })).toBe(
    "Reloj de cuerda y 2 más",
  );
  expect(orderItemLabel({ name: "Reloj de cuerda", image_url: null, more: 0 })).toBe(
    "Reloj de cuerda",
  );
});

test("reads an order row from before its line was returned as having none", () => {
  // The interface can reach a database that has not been given the columns yet.
  const older = { ...orderRow } as Partial<ConversationRow>;
  delete older.order_item_name;
  delete older.order_item_image_path;
  delete older.order_item_count;

  const [summary] = mapConversationRows([older as ConversationRow]);

  expect(summary.order_item).toBeNull();
});

const notice: PlatformNotice = {
  id: 2,
  kind: "announcement",
  title: "Mantenimiento el sábado",
  body: "La plaza estará en pausa por la noche.",
  action: null,
  // Between the two buying threads above: after 08:00, before 09:00.
  created_at: "2026-08-23T08:30:00+00:00",
  read_at: null,
};

const withNotices = mergeInbox(
  mapConversationRows([
    { ...productRow, conversation_id: 1, counterpart_label: "Casa Niebla", unread_count: 0, ...at(9) },
    { ...orderRow, conversation_id: 2, counterpart_label: "Taller Volcán", unread_count: 1, ...at(8) },
  ]),
  mapConversationRows([{ ...row, conversation_id: 3, unread_count: 4, ...at(7) }]),
  [
    notice,
    {
      ...notice,
      id: 9,
      kind: "direct",
      title: "Sobre tu cuenta",
      body: "Escríbenos cuando puedas.",
      created_at: "2026-08-23T06:00:00+00:00",
      read_at: "2026-08-23T06:30:00+00:00",
    },
  ],
);

test("places notices among conversations by when they arrived", () => {
  expect(withNotices.map((entry) => entry.key)).toEqual(["c-1", "n-2", "c-2", "c-3", "n-9"]);
});

test("tells a notice from a conversation that carries the same number", () => {
  // The two ids come from different tables. Only the key and the link tell them apart.
  const sameNumber = withNotices.filter((entry) => entry.id === 2);

  expect(sameNumber.map((entry) => [entry.role, entry.href])).toEqual([
    ["platform", "/mensajes/avisos/2"],
    ["buyer", "/mensajes/2"],
  ]);
});

test("counts an unopened notice as one unread, and an opened one as none", () => {
  const unread = Object.fromEntries(withNotices.map((entry) => [entry.key, entry.unread_count]));

  expect(unread["n-2"]).toBe(1);
  expect(unread["n-9"]).toBe(0);
});

test("filters to what the plaza sent", () => {
  expect(filterInbox(withNotices, "platform").map((entry) => entry.key)).toEqual(["n-2", "n-9"]);
  expect(filterInbox(withNotices, "buying").map((entry) => entry.key)).toEqual(["c-1", "c-2"]);
  expect(filterInbox(withNotices, "selling").map((entry) => entry.key)).toEqual(["c-3"]);
});

test("lists unread notices with unread conversations", () => {
  expect(filterInbox(withNotices, "unread").map((entry) => entry.key)).toEqual(["n-2", "c-2", "c-3"]);
});

test("keeps the open notice under unread, and not the conversation with its number", () => {
  const opened = withNotices.map((entry) => ({ ...entry, unread_count: 0 }));

  expect(filterInbox(opened, "unread", "", "n-2").map((entry) => entry.key)).toEqual(["n-2"]);
});

test("searches a notice by its title, its body and its sender", () => {
  expect(filterInbox(withNotices, "all", "sabado").map((entry) => entry.key)).toEqual(["n-2"]);
  expect(filterInbox(withNotices, "all", "en pausa").map((entry) => entry.key)).toEqual(["n-2"]);
  expect(filterInbox(withNotices, "all", "plaza volcanes").map((entry) => entry.key)).toEqual([
    "n-2",
    "n-9",
  ]);
});

test("adds unread notices to the totals", () => {
  expect(unreadTotals(withNotices)).toEqual({ all: 6, buying: 1, selling: 4, platform: 1 });
});

test("still merges an inbox that has no notices", () => {
  expect(mergeInbox([], mapConversationRows([row])).map((entry) => entry.key)).toEqual(["c-7"]);
});
