import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShopForm } from "@/components/shops/shop-form";
import type { ActionState } from "@/lib/action-state";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });

afterEach(cleanup);

describe("ShopForm", () => {
  it("shows México as a disabled country and requires a primary state", () => {
    render(<ShopForm action={action} />);

    expect(screen.getByLabelText("País")).toBeDisabled();
    expect(screen.getByLabelText("País")).toHaveValue("MX");
    expect(screen.getByLabelText("Estado principal")).toBeRequired();
    expect(screen.getByLabelText("Segundo estado (opcional)")).not.toBeRequired();
    expect(
      within(screen.getByLabelText("Estado principal")).getByRole("option", { name: "Jalisco" }),
    ).toBeInTheDocument();
  });

  it("submits both states under the same field name", () => {
    render(<ShopForm action={action} />);

    expect(screen.getByLabelText("Estado principal")).toHaveAttribute(
      "name",
      "administrative_area_codes",
    );
    expect(screen.getByLabelText("Segundo estado (opcional)")).toHaveAttribute(
      "name",
      "administrative_area_codes",
    );
  });

  it("drops the primary state from the second list so it cannot be picked twice", () => {
    render(<ShopForm action={action} />);

    fireEvent.change(screen.getByLabelText("Estado principal"), {
      target: { value: "MX-JAL" },
    });

    const secondary = screen.getByLabelText("Segundo estado (opcional)");
    expect(within(secondary).queryByRole("option", { name: "Jalisco" })).not.toBeInTheDocument();
    expect(within(secondary).getByRole("option", { name: "Colima" })).toBeInTheDocument();
  });

  it("clears the second state when the primary takes its place", () => {
    render(<ShopForm action={action} />);
    const primary = screen.getByLabelText("Estado principal");
    const secondary = screen.getByLabelText("Segundo estado (opcional)");

    fireEvent.change(primary, { target: { value: "MX-JAL" } });
    fireEvent.change(secondary, { target: { value: "MX-COL" } });
    expect(secondary).toHaveValue("MX-COL");

    fireEvent.change(primary, { target: { value: "MX-COL" } });

    expect(secondary).toHaveValue("");
  });

  it("preserves both selected states while editing", () => {
    render(
      <ShopForm
        action={action}
        shop={{
          name: "Casa Niebla",
          description: "Objetos hechos en un taller al pie del volcán.",
          imageUrl: null,
          countryCode: "MX",
          administrativeAreaCodes: ["MX-PUE", "MX-OAX"],
        }}
      />,
    );

    expect(screen.getByLabelText("Estado principal")).toHaveValue("MX-PUE");
    expect(screen.getByLabelText("Segundo estado (opcional)")).toHaveValue("MX-OAX");
  });
});
