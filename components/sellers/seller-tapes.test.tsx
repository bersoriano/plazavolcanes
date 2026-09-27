import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerTapes } from "@/components/sellers/seller-tapes";

afterEach(cleanup);

function exposed(container: HTMLElement) {
  return [...container.querySelectorAll("span, em")]
    .filter((node) => !node.closest("[aria-hidden='true']") && node.children.length === 0)
    .map((node) => node.textContent);
}

describe("SellerTapes", () => {
  it("lists the founder perks and the platforms once each for a screen reader", () => {
    const { container } = render(<SellerTapes promoActive />);

    expect(exposed(container)).toEqual([
      "50 productos",
      "insignia fundadora",
      "0% comisión 12 meses",
      "pago directo",
      "25 productos gratis para todas",
      "Muestra tu perfil de",
      "Mercado Libre",
      "Facebook Marketplace",
    ]);
  });

  it("stops promising founder perks once the promotion has ended", () => {
    const { container } = render(<SellerTapes promoActive={false} />);

    expect(container.textContent).not.toMatch(/50 productos|fundadora|12 meses/);
    expect(container.textContent).toContain("25 productos gratis");
  });
});
