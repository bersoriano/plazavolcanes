import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShopForm } from "@/components/shops/shop-form";
import type { ActionState } from "@/lib/action-state";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });

afterEach(cleanup);

describe("ShopForm", () => {
  it("shows México as a disabled country and requires a state", () => {
    render(<ShopForm action={action} />);

    expect(screen.getByLabelText("País")).toBeDisabled();
    expect(screen.getByLabelText("País")).toHaveValue("MX");
    expect(screen.getByLabelText("Estado")).toBeRequired();
    expect(screen.getByRole("option", { name: "Jalisco" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ciudad de México" })).toBeInTheDocument();
  });

  it("preserves selected state while editing", () => {
    render(
      <ShopForm
        action={action}
        shop={{
          name: "Casa Niebla",
          description: "Objetos hechos en un taller al pie del volcán.",
          imageUrl: null,
          countryCode: "MX",
          administrativeAreaCode: "MX-PUE",
        }}
      />,
    );

    expect(screen.getByLabelText("Estado")).toHaveValue("MX-PUE");
  });
});
