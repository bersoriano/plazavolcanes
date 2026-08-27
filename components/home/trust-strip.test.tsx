import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrustStrip } from "@/components/home/trust-strip";

afterEach(cleanup);

describe("TrustStrip", () => {
  it("explains direct-payment limits without promising protection", () => {
    render(<TrustStrip />);

    const guidance = screen.getByRole("region", { name: "Antes de acordar una compra" });

    expect(
      within(guidance).getByText(
        "Acuerdas el método de pago con la tienda y le pagas directamente. Plaza Volcanes no procesa, retiene ni puede devolver ese dinero.",
      ),
    ).toBeInTheDocument();
    expect(guidance).not.toHaveTextContent(
      /arbitraje|compra con respaldo|compra protegida|pago seguro/i,
    );
  });

  it("describes the dispute flow without claiming evidence is collected", () => {
    render(<TrustStrip />);

    const guidance = screen.getByRole("region", { name: "Antes de acordar una compra" });

    expect(
      within(guidance).getByText(
        "Abres una aclaración con tu descripción de lo ocurrido. El vendedor puede responder y administración puede registrar una resolución. Plaza Volcanes no retiene el pago ni obliga a un reembolso.",
      ),
    ).toBeInTheDocument();
    // No code path collects evidence: the dispute schemas have no evidence
    // field and both actions pass p_evidence: [] unconditionally.
    expect(guidance).not.toHaveTextContent(/evidencia/i);
  });

  it("links the claims process instead of describing an outcome", () => {
    render(<TrustStrip />);

    expect(
      screen.getByRole("link", { name: /quejas y aclaraciones/i }),
    ).toHaveAttribute("href", "/quejas-y-aclaraciones");
  });
});
