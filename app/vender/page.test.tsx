import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SellerPage, { metadata } from "@/app/vender/page";

afterEach(cleanup);

describe("Seller page", () => {
  it("publishes static metadata for store setup and the direct-sale model", () => {
    expect(metadata).toEqual({
      title: "Vender",
      description:
        "Abre tu tienda en Plaza Volcanes, publica tus productos y acuerda pago y entrega directamente con cada persona compradora.",
    });
  });

  it("renders the complete seller program", () => {
    render(<SellerPage />);

    expect(screen.getByRole("heading", { name: "Vende en Plaza Volcanes" })).toBeInTheDocument();
    expect(screen.getByText("Crea tu tienda")).toBeInTheDocument();
    expect(screen.getByText("Recibe solicitudes")).toBeInTheDocument();
    expect(screen.getByText("Mejor valorada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir mi tienda" })).toHaveAttribute(
      "href",
      "/registro",
    );
    expect(screen.getByRole("link", { name: "Ya tengo cuenta" })).toHaveAttribute(
      "href",
      "/ingresar",
    );
  });
});
