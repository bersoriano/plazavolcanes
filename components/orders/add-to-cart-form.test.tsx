import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AddToCartForm } from "@/components/orders/add-to-cart-form";
import type { ActionState } from "@/lib/action-state";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });

afterEach(cleanup);

describe("AddToCartForm", () => {
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

  it("says so when a single unit is left", () => {
    render(<AddToCartForm action={action} productPath="/productos/taza" unitsAvailable={1} />);

    expect(screen.getByLabelText(/Cantidad/)).toHaveAttribute("max", "1");
    expect(screen.getByText("Queda 1 unidad")).toBeInTheDocument();
  });
});
