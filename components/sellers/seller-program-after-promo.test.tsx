import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SellerProgram } from "@/components/sellers/seller-program";

vi.mock("@/lib/launch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/launch")>()),
  isFoundersPromoActive: () => false,
}));

afterEach(cleanup);

describe("SellerProgram after the founders promotion", () => {
  it("no longer mentions the founders spots anywhere", () => {
    const { container } = render(<SellerProgram />);

    expect(container.textContent).not.toMatch(/primeras 100|tres meses|Lanzamiento|fundadoras/i);
    expect(screen.queryByRole("region", { name: "Sé una de las primeras 100 tiendas." })).not.toBeInTheDocument();
  });

  it("states what every shop keeps instead", () => {
    render(<SellerProgram />);

    expect(screen.getByText("Publica gratis · 0% comisión")).toBeInTheDocument();
    expect(
      screen.getByText("Sí. Publicar es gratis y Plaza Volcanes no cobra comisión por cada artículo vendido."),
    ).toBeInTheDocument();
    expect(screen.queryByText("¿Qué pasa cuando termine la promoción?")).not.toBeInTheDocument();
    expect(screen.getByText("Sin retenciones ni comisiones", { selector: "h3" })).toBeInTheDocument();
  });
});
