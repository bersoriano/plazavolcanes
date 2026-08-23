import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { StartConversationButton } from "@/components/messages/start-conversation-button";

afterEach(cleanup);

test("invites a signed-in shopper to write", () => {
  render(<StartConversationButton action={vi.fn()} isOwnShop={false} shopId={3} signedIn />);

  expect(screen.getByRole("button", { name: /mensaje a la tienda/i })).toBeInTheDocument();
});

test("sends a signed-out visitor to sign in instead", () => {
  render(<StartConversationButton action={vi.fn()} isOwnShop={false} shopId={3} signedIn={false} />);

  expect(screen.getByRole("link", { name: /mensaje a la tienda/i })).toHaveAttribute(
    "href",
    "/ingresar?continuar=/mensajes",
  );
});

test("shows nothing to the shop's own owner", () => {
  const { container } = render(
    <StartConversationButton action={vi.fn()} isOwnShop shopId={3} signedIn />,
  );

  expect(container).toBeEmptyDOMElement();
});
