import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerFaq } from "@/components/sellers/seller-faq";

afterEach(cleanup);

function questions() {
  return [...document.querySelectorAll("summary")].map((summary) => summary.textContent);
}

describe("SellerFaq", () => {
  it("asks the founders questions first and last while the promotion runs", () => {
    render(<SellerFaq />);

    expect(questions()).toEqual([
      "¿Qué incluye ser tienda fundadora?",
      "¿De verdad no cobran comisión?",
      "¿Cómo recibo mi dinero?",
      "¿Cuántos productos puedo publicar?",
      "¿Qué pasa si hay un problema con un pedido?",
      "¿Qué pasa después del primer año?",
    ]);
    expect(
      screen.getByText(
        "Al terminar el primer año, la tienda y los 50 artículos publicados dejan de ser gratuitos. La comisión sigue en 0% y tu cliente te sigue pagando directo.",
      ),
    ).toBeInTheDocument();
  });

  it("is one exclusive accordion with the first item open", () => {
    const { container } = render(<SellerFaq />);

    const items = [...container.querySelectorAll("details")];
    expect(items.every((item) => item.getAttribute("name") === "preguntas")).toBe(true);
    expect(items.map((item) => item.open)).toEqual([true, false, false, false, false, false]);
  });

  it("drops both founders questions once the promotion has ended", () => {
    render(<SellerFaq promoActive={false} />);

    expect(questions()).not.toContain("¿Qué incluye ser tienda fundadora?");
    expect(questions()).not.toContain("¿Qué pasa después del primer año?");
  });
});
