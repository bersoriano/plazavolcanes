import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { ConversationList } from "@/components/messages/conversation-list";
import type { ConversationProduct, ConversationSummary } from "@/lib/queries/messages";

afterEach(cleanup);

const conversation: ConversationSummary = {
  id: 7,
  type: "pre_sale",
  order_id: null,
  shop_id: 3,
  shop_name: "Tienda Prueba",
  shop_slug: "tienda-prueba",
  counterpart_label: "Ana Ruiz",
  product: null,
  unread_count: 2,
  last_message: {
    body: "¿Sigue disponible?",
    created_at: "2026-08-23T10:00:00Z",
    sender_id: "them",
  },
};

const product: ConversationProduct = {
  id: 12,
  name: "Taza de barro",
  image_url: "https://cdn.test/taza.jpg",
  price: 250,
  currency_code: "MXN",
  is_available: true,
  href: "/productos/taza-de-barro",
};

const productThread: ConversationSummary = { ...conversation, product };

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

  expect(screen.getByText("Pedido #12")).toBeInTheDocument();
});

test("says a thread with no product is a general enquiry", () => {
  render(<ConversationList basePath="/mensajes" conversations={[conversation]} />);

  expect(screen.getByText("Consulta general")).toBeInTheDocument();
});

test("shows the listing a product thread is about", () => {
  render(<ConversationList basePath="/mensajes" conversations={[productThread]} />);

  expect(screen.getByAltText("Taza de barro")).toHaveAttribute("src", "https://cdn.test/taza.jpg");
  expect(screen.getByText("Taza de barro")).toBeInTheDocument();
  expect(screen.getByText("$250.00")).toBeInTheDocument();
  expect(screen.queryByText("Consulta general")).not.toBeInTheDocument();
});

test("shows the price the listing carries today", () => {
  render(
    <ConversationList
      basePath="/mensajes"
      conversations={[{ ...productThread, product: { ...product, price: 275 } }]}
    />,
  );

  expect(screen.getByText("$275.00")).toBeInTheDocument();
});

test("says in words when a listing is no longer available", () => {
  render(
    <ConversationList
      basePath="/mensajes"
      conversations={[
        { ...productThread, product: { ...product, is_available: false, href: null } },
      ]}
    />,
  );

  expect(screen.getByText("Ya no disponible")).toBeInTheDocument();
});

test("falls back to a placeholder when the listing has no image", () => {
  render(
    <ConversationList
      basePath="/mensajes"
      conversations={[{ ...productThread, product: { ...product, image_url: null } }]}
    />,
  );

  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByText("Taza de barro")).toBeInTheDocument();
});

test("names the shop to a buyer and the person to a seller", () => {
  // One field, filled by the inbox query according to who is asking. The list
  // renders whichever identity arrived, in either inbox.
  const { unmount } = render(
    <ConversationList
      basePath="/mensajes"
      conversations={[{ ...productThread, counterpart_label: "Tienda Prueba" }]}
    />,
  );

  expect(screen.getByText("Tienda Prueba")).toBeInTheDocument();
  unmount();

  render(<ConversationList basePath="/mensajes" conversations={[productThread]} />);

  expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
});

test("keeps every kind of thread reachable from one list", () => {
  render(
    <ConversationList
      basePath="/mensajes"
      conversations={[
        productThread,
        { ...conversation, id: 8 },
        { ...conversation, id: 9, type: "order", order_id: 12 },
      ]}
    />,
  );

  expect(screen.getAllByRole("link")).toHaveLength(3);
});

test("reads the listing before the message it belongs to", () => {
  // The row is context first, conversation second: a product thread can never be
  // read as if the listing name were part of the message preview.
  render(<ConversationList basePath="/mensajes" conversations={[productThread]} />);

  expect(screen.getByRole("link").textContent).toMatch(
    /Taza de barro[\s\S]*\$250\.00[\s\S]*Ana Ruiz[\s\S]*¿Sigue disponible\?/,
  );
});

test("reads the order before the message it belongs to", () => {
  render(
    <ConversationList
      basePath="/mensajes"
      conversations={[{ ...conversation, type: "order", order_id: 12 }]}
    />,
  );

  expect(screen.getByRole("link").textContent).toMatch(
    /Pedido #12[\s\S]*Ana Ruiz[\s\S]*¿Sigue disponible\?/,
  );
});

test("leaves a general enquiry as one plain row led by the person", () => {
  render(<ConversationList basePath="/mensajes" conversations={[conversation]} />);

  expect(screen.getByRole("link").textContent).toMatch(
    /Ana Ruiz[\s\S]*Consulta general[\s\S]*¿Sigue disponible\?/,
  );
});

test("keeps the order label off a thread that carries a listing", () => {
  render(
    <ConversationList
      basePath="/mensajes"
      conversations={[{ ...productThread, type: "order", order_id: 12 }]}
    />,
  );

  expect(screen.getByRole("link").textContent).toMatch(/Pedido #12[\s\S]*Taza de barro/);
});
