import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AddToCartForm } from "@/components/orders/add-to-cart-form";
import type { ActionState } from "@/lib/action-state";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });

afterEach(cleanup);

describe("AddToCartForm", () => {
  it("offers no purchase once the listing sold out", () => {
    render(<AddToCartForm action={action} productPath="/productos/taza" unitsAvailable={0} />);

    expect(screen.queryByRole("button", { name: /Solicitar compra/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Cantidad/)).not.toBeInTheDocument();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByText("Pregúntale a la tienda si volverá a tenerlo.")).toBeInTheDocument();
  });

  it("caps the quantity at the units the listing covers", () => {
    render(<AddToCartForm action={action} productPath="/productos/taza" unitsAvailable={3} />);

    expect(screen.getByLabelText(/Cantidad/)).toHaveAttribute("max", "3");
    expect(screen.getByText("Quedan 3 unidades")).toBeInTheDocument();
  });

  it("remembers which product page the request came from", () => {
    render(
      <AddToCartForm action={action} productPath="/productos/taza" unitsAvailable={3} />,
    );

    const field = document.querySelector('input[name="producto"]');

    expect(field).toHaveAttribute("type", "hidden");
    expect(field).toHaveValue("/productos/taza");
  });

  it("inks the request button to match its brand fill in every theme", () => {
    render(<AddToCartForm action={action} productPath="/productos/taza" unitsAvailable={1} />);

    // The fill is gold inside a premium product page, where white ink fails.
    const button = screen.getByRole("button", { name: /Solicitar compra/ });

    expect(button).toHaveClass("bg-brand", "text-on-brand");
    expect(button).not.toHaveClass("text-white");
  });

  it("says so when a single unit is left", () => {
    render(<AddToCartForm action={action} productPath="/productos/taza" unitsAvailable={1} />);

    expect(screen.getByLabelText(/Cantidad/)).toHaveAttribute("max", "1");
    expect(screen.getByText("Queda 1 unidad")).toBeInTheDocument();
  });
});
