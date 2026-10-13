import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { ThreadHeader } from "@/components/messages/thread-header";
import type { Thread } from "@/lib/queries/messages";

afterEach(cleanup);

const thread: Thread = {
  id: 7,
  type: "order",
  order_id: 41,
  viewer_role: "seller",
  counterpart_label: "Ana Ruiz",
  shop_name: "Taller Volcán",
  shop_slug: "taller-volcan",
  product: null,
  order_item: { name: "Reloj de cuerda", image_url: null, more: 0 },
  current_user_id: "me",
  messages: [],
};

test("names the counterpart as the page heading", () => {
  render(<ThreadHeader thread={thread} />);

  expect(screen.getByRole("heading", { level: 1, name: "Ana Ruiz" })).toBeInTheDocument();
});

test("tells a seller which shop the conversation reached", () => {
  render(<ThreadHeader thread={thread} />);

  expect(screen.getByText("Venta · Taller Volcán")).toBeInTheDocument();
});

test("tells a buyer the conversation is about something they are buying", () => {
  render(<ThreadHeader thread={{ ...thread, viewer_role: "buyer", counterpart_label: "Taller Volcán" }} />);

  expect(screen.getByText("Compra")).toBeInTheDocument();
});

test("leads back to the list", () => {
  render(<ThreadHeader thread={thread} />);

  expect(screen.getByRole("link", { name: "Volver a mensajes" })).toHaveAttribute("href", "/mensajes");
});

test("sends each side to its own view of the order", () => {
  const { rerender } = render(<ThreadHeader thread={thread} />);
  expect(screen.getByRole("link", { name: /Ver el pedido #41/ })).toHaveAttribute(
    "href",
    "/panel/pedidos/41",
  );

  rerender(<ThreadHeader thread={{ ...thread, viewer_role: "buyer" }} />);
  expect(screen.getByRole("link", { name: /Ver el pedido #41/ })).toHaveAttribute(
    "href",
    "/compras/41",
  );
});
