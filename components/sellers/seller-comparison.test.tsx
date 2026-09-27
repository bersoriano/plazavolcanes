import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerComparison } from "@/components/sellers/seller-comparison";

afterEach(cleanup);

describe("SellerComparison", () => {
  it("compares four platforms on the six questions sellers ask", () => {
    render(<SellerComparison />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Plaza Volcanes",
      "Mercado Libre",
      "Facebook Marketplace",
      "eBay",
    ]);
    expect(within(table).getAllByRole("rowheader").map((header) => header.textContent)).toEqual([
      "Comisión",
      "Retención",
      "Tienda permanente",
      "Cómo cobras",
      "Reputación",
      "Pedido por escrito",
    ]);
  });

  it("keeps our commission claim to direct payment and says it is not affiliated", () => {
    render(<SellerComparison />);

    expect(screen.getAllByText("0% en pago directo").length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent(/para siempre|garantizad/i);
    expect(document.body).toHaveTextContent("Plaza Volcanes no está afiliada a ellas.");
  });
});
