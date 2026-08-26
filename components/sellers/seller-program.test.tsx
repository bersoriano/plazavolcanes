import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerProgram } from "@/components/sellers/seller-program";
import { getTrustTierMarker } from "@/lib/trust-tiers";

afterEach(cleanup);

describe("SellerProgram", () => {
  it("explains the ordered store setup and every trust tier", () => {
    render(<SellerProgram />);

    const program = screen.getByRole("region", { name: "Vende en Plaza Volcanes" });
    const steps = within(program).getAllByRole("listitem");

    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Paso 1");
    expect(steps[0]).toHaveTextContent("Crea tu tienda");
    expect(steps[1]).toHaveTextContent("Paso 2");
    expect(steps[1]).toHaveTextContent("Publica tus productos");
    expect(steps[2]).toHaveTextContent("Paso 3");
    expect(steps[2]).toHaveTextContent("Recibe solicitudes");

    for (const tier of ["standard", "reliable", "top_rated"] as const) {
      const marker = getTrustTierMarker(tier);
      expect(within(program).getByText(marker.label)).toBeInTheDocument();
      expect(
        within(program).getByText(`${marker.listingLimit} productos publicados`),
      ).toBeInTheDocument();
      expect(within(program).getByText(marker.tooltip)).toBeInTheDocument();
    }
  });

  it("states the direct-sale limits and offers registration and sign-in", () => {
    render(<SellerProgram />);

    const program = screen.getByRole("region", { name: "Vende en Plaza Volcanes" });

    expect(program).toHaveTextContent(
      "Tú y la persona compradora acuerdan el pago y la entrega directamente. Plaza Volcanes no procesa ni retiene fondos.",
    );
    expect(within(program).getByRole("link", { name: "Abrir mi tienda" })).toHaveAttribute(
      "href",
      "/registro",
    );
    expect(within(program).getByRole("link", { name: "Ya tengo cuenta" })).toHaveAttribute(
      "href",
      "/ingresar",
    );
    expect(program).not.toHaveTextContent(
      /compra protegida|pago seguro|garantizamos|garantía|reembolso garantizado/i,
    );
  });
});
