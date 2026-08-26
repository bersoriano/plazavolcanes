import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerPitch } from "@/components/home/seller-pitch";

afterEach(cleanup);

describe("SellerPitch", () => {
  it("offers one concise path to open a store and one path to seller details", () => {
    render(<SellerPitch />);

    const pitch = screen.getByRole("region", { name: "Vende en Plaza Volcanes" });

    expect(within(pitch).getByRole("heading", { name: "Vende en Plaza Volcanes" }))
      .toBeInTheDocument();
    expect(pitch).toHaveTextContent(
      "Abre tu tienda, publica tus productos y recibe solicitudes sin comisiones.",
    );
    expect(within(pitch).getByRole("link", { name: "Abrir mi tienda" })).toHaveAttribute(
      "href",
      "/registro",
    );
    expect(within(pitch).getByRole("link", { name: "Conoce cómo funciona" })).toHaveAttribute(
      "href",
      "/vender",
    );
  });

  it("leaves ordered setup steps and trust-tier details to the seller page", () => {
    render(<SellerPitch />);

    const pitch = screen.getByRole("region", { name: "Vende en Plaza Volcanes" });

    expect(within(pitch).queryByRole("list")).not.toBeInTheDocument();
    expect(pitch).not.toHaveTextContent(/Paso 1|Paso 2|Paso 3/);
    expect(pitch).not.toHaveTextContent(/Estándar|Confiable|Mejor valorada/);
    expect(pitch).not.toHaveTextContent(/productos publicados/);
  });
});
