import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BenefitsBento } from "@/components/home/landing/benefits-bento";

afterEach(cleanup);

describe("BenefitsBento", () => {
  it("is the #vender anchor, named by its heading", () => {
    render(<BenefitsBento />);

    const section = screen.getByRole("region", { name: "Lo que vendes, es tuyo." });
    expect(section).toHaveAttribute("id", "vender");
  });

  it("states the founder sentence and how a seat is earned", () => {
    render(<BenefitsBento />);

    expect(screen.getByRole("heading", { level: 3, name: "0% de comisión fija 12 meses." })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Primeras 100 tiendas: 50 productos, insignia fundadora y 0% comisión fija 12 meses. Todas las demás: 25 productos gratis. Se gana publicando 8 productos en tus primeros 7 días.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("$1,999.00")).toHaveLength(2);
  });

  it("titles each benefit as a card heading", () => {
    render(<BenefitsBento />);

    const section = screen.getByRole("region", { name: "Lo que vendes, es tuyo." });
    expect(within(section).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "0% de comisión fija 12 meses.",
      "Sin retenciones",
      "Muestra tu reputación",
      "Tu catálogo en un solo lugar",
      "Todo queda por escrito",
    ]);
  });

  it("drops the founders block once the promotion has ended", () => {
    render(<BenefitsBento promoActive={false} />);

    expect(screen.queryByRole("heading", { level: 3, name: "0% de comisión fija 12 meses." })).not.toBeInTheDocument();
    expect(screen.queryByText("TIENDAS FUNDADORAS")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
  });
});
