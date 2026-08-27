import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrustStrip } from "@/components/home/trust-strip";

afterEach(cleanup);

describe("TrustStrip", () => {
  it("explains direct-payment and dispute limits without promising protection", () => {
    render(<TrustStrip />);

    const guidance = screen.getByRole("region", { name: "Antes de acordar una compra" });

    expect(
      within(guidance).getByText(
        "Acuerdas el método de pago con la tienda y le pagas directamente. Plaza Volcanes no procesa, retiene ni puede devolver ese dinero.",
      ),
    ).toBeInTheDocument();
    expect(
      within(guidance).getByText(
        "Puedes abrir una disputa y adjuntar evidencia. Administración puede revisarla y registrar una resolución, pero Plaza Volcanes no controla el pago ni garantiza un reembolso.",
      ),
    ).toBeInTheDocument();
    expect(guidance).not.toHaveTextContent(
      /arbitraje|compra con respaldo|compra protegida|pago seguro/i,
    );
  });
});
