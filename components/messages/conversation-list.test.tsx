import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { ConversationList } from "@/components/messages/conversation-list";
import type { ConversationSummary } from "@/lib/queries/messages";

afterEach(cleanup);

const conversation: ConversationSummary = {
  id: 7,
  type: "pre_sale",
  order_id: null,
  shop_id: 3,
  shop_name: "Tienda Prueba",
  shop_slug: "tienda-prueba",
  counterpart_label: "Ana Ruiz",
  unread_count: 2,
  last_message: {
    body: "¿Sigue disponible?",
    created_at: "2026-08-23T10:00:00Z",
    sender_id: "them",
  },
};

test("links each thread to its own page", () => {
  render(<ConversationList basePath="/mensajes" conversations={[conversation]} />);

  expect(screen.getByRole("link", { name: /Ana Ruiz/ })).toHaveAttribute("href", "/mensajes/7");
});

test("shows how many messages are waiting", () => {
  render(<ConversationList basePath="/mensajes" conversations={[conversation]} />);

  expect(screen.getByLabelText(/2 mensajes sin leer/i)).toBeInTheDocument();
});

test("shows no unread marker on a thread that is caught up", () => {
  render(
    <ConversationList basePath="/mensajes" conversations={[{ ...conversation, unread_count: 0 }]} />,
  );

  expect(screen.queryByLabelText(/mensajes sin leer/i)).not.toBeInTheDocument();
});

test("marks which threads belong to an order", () => {
  render(
    <ConversationList
      basePath="/mensajes"
      conversations={[{ ...conversation, type: "order", order_id: 12 }]}
    />,
  );

  expect(screen.getByText(/pedido #12/i)).toBeInTheDocument();
});

test("says so when a thread has no messages yet", () => {
  render(
    <ConversationList basePath="/mensajes" conversations={[{ ...conversation, last_message: null }]} />,
  );

  expect(screen.getByText(/sin mensajes todavía/i)).toBeInTheDocument();
});

test("explains an empty inbox instead of showing nothing", () => {
  render(<ConversationList basePath="/mensajes" conversations={[]} />);

  expect(screen.getByText(/no tienes conversaciones/i)).toBeInTheDocument();
});

test("uses the base path it was given, so the seller inbox links into the panel", () => {
  render(<ConversationList basePath="/panel/mensajes" conversations={[conversation]} />);

  expect(screen.getByRole("link", { name: /Ana Ruiz/ })).toHaveAttribute(
    "href",
    "/panel/mensajes/7",
  );
});
