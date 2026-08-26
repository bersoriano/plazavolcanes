import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { StartConversationButton } from "@/components/messages/start-conversation-button";

afterEach(cleanup);

test("invites a signed-in shopper to write", () => {
  render(
    <StartConversationButton
      action={vi.fn()}
      isOwnShop={false}
      returnTo="/tiendas/casa-niebla"
      signedIn
    />,
  );

  expect(screen.getByRole("button", { name: /mensaje a la tienda/i })).toBeInTheDocument();
});

test("says what a product page is asking about", () => {
  render(
    <StartConversationButton
      action={vi.fn()}
      isOwnShop={false}
      label="Preguntar por este producto"
      returnTo="/productos/taza-de-barro"
      signedIn
    />,
  );

  expect(screen.getByRole("button", { name: /preguntar por este producto/i })).toBeInTheDocument();
});

test("sends a signed-out visitor back to the page they asked from", () => {
  render(
    <StartConversationButton
      action={vi.fn()}
      isOwnShop={false}
      label="Preguntar por este producto"
      returnTo="/productos/taza-de-barro"
      signedIn={false}
    />,
  );

  expect(screen.getByRole("link", { name: /preguntar por este producto/i })).toHaveAttribute(
    "href",
    "/ingresar?continuar=%2Fproductos%2Ftaza-de-barro",
  );
});

test("shows nothing to the shop's own owner", () => {
  const { container } = render(
    <StartConversationButton action={vi.fn()} isOwnShop returnTo="/tiendas/casa-niebla" signedIn />,
  );

  expect(container).toBeEmptyDOMElement();
});

test("never carries the shop or the product in the form itself", () => {
  const { container } = render(
    <StartConversationButton
      action={vi.fn()}
      isOwnShop={false}
      returnTo="/productos/taza-de-barro"
      signedIn
    />,
  );

  expect(container.querySelectorAll("input[type=hidden]")).toHaveLength(0);
});
