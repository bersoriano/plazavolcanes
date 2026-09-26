import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerProgram } from "@/components/sellers/seller-program";

afterEach(cleanup);

describe("SellerProgram after the founders promotion", () => {
  it("no longer mentions the founders spots anywhere", () => {
    const { container } = render(<SellerProgram founders={{ open: false, taken: 100, cap: 100 }} />);

    expect(container.textContent).not.toMatch(/primeras 100|tres meses|Lanzamiento|fundadora|mes 13/i);
    expect(screen.queryByRole("region", { name: "Sé una de las primeras 100 tiendas." })).not.toBeInTheDocument();
  });

  it("states what every shop keeps instead", () => {
    render(<SellerProgram founders={{ open: false, taken: 100, cap: 100 }} />);

    expect(screen.getByText("25 productos gratis · pago directo")).toBeInTheDocument();
    expect(
      screen.getByText(/^En pago directo, no: tu cliente te paga a ti/),
    ).toBeInTheDocument();
    expect(screen.queryByText("¿Qué pasa cuando termine la promoción?")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Tu cliente te paga directo a ti." })).toBeInTheDocument();
  });

  it("ends the seller path at orders and keeps the ladder without the founders marker", () => {
    render(<SellerProgram founders={{ open: false, taken: 100, cap: 100 }} />);

    const steps = within(screen.getByRole("region", { name: "De cero a tienda en tres pasos." })).getAllByRole("listitem");
    expect(steps[2]).toHaveTextContent("Recibe pedidos");
    expect(screen.getByRole("region", { name: "Tu nivel habla por tu servicio." })).toBeInTheDocument();
    expect(screen.queryByText(/Tiendas fundadoras: 50/)).not.toBeInTheDocument();
  });
});
