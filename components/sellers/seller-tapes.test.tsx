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
      "0% comisión",
      "pago directo",
      "Hasta 50 artículos gratis",
      "insignia fundadora",
      "Premium por 1 año",
      "Trae tu reputación de",
      "Mercado Libre",
      "Facebook Marketplace",
      "Amazon",
      "Etsy",
      "Instagram",
    ]);
  });

  it("stops promising founder perks once the promotion has ended", () => {
    const { container } = render(<SellerTapes promoActive={false} />);

    expect(container.textContent).not.toMatch(/50 artículos|fundadora|Premium/);
    expect(container.textContent).toContain("0% comisión");
  });
});
