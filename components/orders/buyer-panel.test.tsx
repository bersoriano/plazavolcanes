import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BuyerPanel } from "@/components/orders/buyer-panel";

afterEach(cleanup);

describe("BuyerPanel", () => {
  it("shows the buyer's own contact details", () => {
    render(<BuyerPanel buyer={{ displayName: "Ana Ruiz", email: "ana@test.local", phone: "+523312345678" }} />);

    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("ana@test.local")).toBeInTheDocument();
    expect(screen.getByText("+523312345678")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar mis datos" })).toHaveAttribute("href", "/panel/cuenta");
  });

  it("asks for a phone number when there is none", () => {
    render(<BuyerPanel buyer={{ displayName: "Ana Ruiz", email: null, phone: null }} />);

    expect(screen.getByText("Sin teléfono guardado")).toBeInTheDocument();
  });
});
