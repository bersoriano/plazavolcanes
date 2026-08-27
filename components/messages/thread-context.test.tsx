import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { ThreadContext } from "@/components/messages/thread-context";
import type { ConversationProduct } from "@/lib/queries/messages";

afterEach(cleanup);

const product: ConversationProduct = {
  id: 12,
  name: "Taza de barro",
  image_url: "https://cdn.test/taza.jpg",
  price: 250,
  currency_code: "MXN",
  is_available: true,
  href: "/productos/taza-de-barro",
};

function renderContext(overrides: Partial<Parameters<typeof ThreadContext>[0]> = {}) {
  return render(
    <ThreadContext
      orderHref={null}
      orderId={null}
      product={null}
      shopName="Tienda Prueba"
      shopSlug="tienda-prueba"
      {...overrides}
    />,
  );
}

test("links a product thread to the listing it is about", () => {
  renderContext({ product });

  const link = screen.getByRole("link", { name: /Taza de barro/ });
  expect(link).toHaveAttribute("href", "/productos/taza-de-barro");
  expect(screen.getByAltText("Taza de barro")).toBeInTheDocument();
  expect(screen.getByText("$250.00")).toBeInTheDocument();
  expect(screen.getByText("Disponible")).toBeInTheDocument();
});

test("keeps the context of a listing that left the plaza, without a link", () => {
  renderContext({ product: { ...product, is_available: false, href: null } });

  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText("Taza de barro")).toBeInTheDocument();
  expect(screen.getByText("Ya no disponible")).toBeInTheDocument();
});

test("names a general enquiry and points back at the shop", () => {
  renderContext();

  expect(screen.getByText(/Consulta general/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Tienda Prueba" })).toHaveAttribute(
    "href",
    "/tiendas/tienda-prueba",
  );
});

test("keeps an order thread pointing at its order", () => {
  renderContext({ orderHref: "/compras/12", orderId: 12 });

  expect(screen.getByRole("link", { name: /Ver el pedido/ })).toHaveAttribute("href", "/compras/12");
  expect(screen.queryByText("Consulta general")).not.toBeInTheDocument();
});

test("shows the seller's own link to an order thread", () => {
  renderContext({ orderHref: "/panel/pedidos/12", orderId: 12 });

  expect(screen.getByRole("link", { name: /Ver el pedido/ })).toHaveAttribute(
    "href",
    "/panel/pedidos/12",
  );
});
