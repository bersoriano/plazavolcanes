import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartItems } from "@/components/orders/cart-items";
import type { CartDetail } from "@/lib/queries/orders.types";

afterEach(cleanup);

function item(overrides: Partial<CartDetail["items"][number]> = {}): CartDetail["items"][number] {
  return {
    id: 1,
    productId: 9,
    quantity: 2,
    product: {
      id: 9,
      name: "Taza de barro",
      price_mxn: 480,
      image_path: "shops/4/taza.jpg",
      image_url: "https://cdn.test/taza.jpg",
      units_available: 5,
      currency_code: "MXN",
    },
    ...overrides,
  };
}

function renderCart(items = [item()], subtotal = 960) {
  return render(
    <CartItems
      items={items}
      quantityAction={() => vi.fn()}
      removeAction={() => vi.fn()}
      subtotal={subtotal}
    />,
  );
}

describe("what the cart shows about a line", () => {
  it("shows the picture the buyer picked", () => {
    // The cart is where somebody checks they are buying the right thing, and
    // getCart already reads image_path for exactly this.
    const { container } = renderCart();

    // alt="" on purpose: the name is right beside it, so announcing the
    // picture too would read the same product twice.
    const thumbnail = container.querySelector("img");

    expect(thumbnail).toHaveAttribute("src", "https://cdn.test/taza.jpg");
    expect(thumbnail).toHaveAttribute("alt", "");
  });

  it("does the multiplication instead of leaving it to the buyer", () => {
    // Two lines, so the line total cannot be confused with the subtotal.
    renderCart([item(), item({ id: 2, quantity: 1 })], 1440);

    const lines = screen.getAllByRole("listitem");

    expect(within(lines[0]).getByText("$960.00")).toBeInTheDocument();
    expect(within(lines[1]).getByText("$480.00")).toBeInTheDocument();
  });

  it("still names the unit price the line is built from", () => {
    renderCart();

    expect(screen.getByText(/\$480\.00 por unidad/)).toBeInTheDocument();
  });

  it("prices a line in the currency the product is sold in", () => {
    // formatMxn hardcoded MXN here while the product page and the order used
    // the row's own currency_code, so the cart was the one place that could
    // put a peso sign on something priced in dollars.
    renderCart([item({ product: { ...item().product!, currency_code: "USD", price_mxn: 25 } })], 50);

    // es-MX renders a foreign currency as "USD 50.00"; the bug was that these
    // said "$50.00" and read as pesos. Both the line and the subtotal move.
    expect(screen.getAllByText("USD 50.00")).toHaveLength(2);
    expect(screen.getByText("USD 25.00 por unidad")).toBeInTheDocument();
  });
});

describe("changing how many", () => {
  it("offers one tap up and one tap down instead of an edit to remember", () => {
    // Typing into a number field and forgetting the update button threw the
    // edit away with no warning. Each press here is the whole change.
    renderCart();

    expect(screen.getByRole("button", { name: "Quitar una unidad de Taza de barro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar una unidad de Taza de barro" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actualizar" })).not.toBeInTheDocument();
  });

  it("sends the quantity the press means", () => {
    renderCart();

    expect(screen.getByRole("button", { name: "Quitar una unidad de Taza de barro" })).toHaveAttribute("value", "1");
    expect(screen.getByRole("button", { name: "Agregar una unidad de Taza de barro" })).toHaveAttribute("value", "3");
  });

  it("stops at the last unit the seller has", () => {
    // The old number field let a buyer ask for 99 of something with 5 in stock
    // and learn about it from a rejected checkout.
    renderCart([item({ quantity: 5 })]);

    expect(screen.getByRole("button", { name: "Agregar una unidad de Taza de barro" })).toBeDisabled();
  });

  it("does not go below one, because that is what removing is for", () => {
    renderCart([item({ quantity: 1 })]);

    expect(screen.getByRole("button", { name: "Quitar una unidad de Taza de barro" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quitar Taza de barro del carrito" })).toBeEnabled();
  });

  it("shows the count between the two controls", () => {
    renderCart([item({ quantity: 3 })]);

    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

describe("a line whose product went away", () => {
  it("says so and still lets the buyer clear it", () => {
    renderCart([item({ product: null })], 0);

    expect(screen.getByText("Producto no disponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Quitar/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agregar una unidad/ })).not.toBeInTheDocument();
  });
});

describe("the total", () => {
  it("adds the lines up in the cart's own currency", () => {
    renderCart([item(), item({ id: 2, quantity: 1 })], 1440);

    const total = screen.getByText("Subtotal").closest("div") as HTMLElement;

    expect(within(total).getByText("$1,440.00")).toBeInTheDocument();
  });
});
