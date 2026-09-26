import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerFaq } from "@/components/sellers/seller-faq";

afterEach(cleanup);

function questions() {
  return [...document.querySelectorAll("summary")].map((summary) => summary.textContent);
}

describe("SellerFaq", () => {
  it("answers the founders package and sellers' objections while the promotion runs", () => {
    render(<SellerFaq />);

    expect(questions()).toEqual([
      "¿Qué incluye ser tienda fundadora?",
      "¿Cobran comisión?",
      "¿Cuántos productos puedo publicar?",
      "¿Quién compra aquí?",
      "¿Cómo recibo mi dinero?",
      "¿Y si el cliente desaparece?",
      "¿Y si una publicación es un fraude?",
      "¿Qué pasa en el mes 13?",
      "¿Puedo irme cuando quiera?",
    ]);
    expect(document.body).toHaveTextContent(
      "Conservas tus 50 productos y tu insignia. Lo único que termina es la comisión fija",
    );
    expect(document.body).not.toHaveTextContent("para siempre");
  });

  it("is one exclusive accordion with the first item open", () => {
    const { container } = render(<SellerFaq />);

    const items = [...container.querySelectorAll("details")];
    expect(items.every((item) => item.getAttribute("name") === "preguntas")).toBe(true);
    expect(items.map((item) => item.open)).toEqual([true, false, false, false, false, false, false, false, false]);
  });

  it("drops both founders questions once the promotion has ended", () => {
    render(<SellerFaq promoActive={false} />);

    expect(questions()).not.toContain("¿Qué incluye ser tienda fundadora?");
    expect(questions()).not.toContain("¿Qué pasa en el mes 13?");
    expect(document.body).not.toHaveTextContent("fundadoras");
  });
});
