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

  it("states the founders offer exactly as the handoff words it", () => {
    render(<BenefitsBento />);

    expect(screen.getByRole("heading", { level: 3, name: "0% de comisión por cada venta." })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Las primeras 100 tiendas que se registren durante los primeros tres meses publican gratis y no pagan comisión por cada artículo vendido.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("$1,999.00")).toHaveLength(2);
  });

  it("titles each benefit as a card heading", () => {
    render(<BenefitsBento />);

    const section = screen.getByRole("region", { name: "Lo que vendes, es tuyo." });
    expect(within(section).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "0% de comisión por cada venta.",
      "Sin retenciones",
      "Transfiere tu reputación",
      "Tu catálogo en un solo lugar",
      "Todo queda por escrito",
    ]);
  });

  it("drops the founders block once the promotion has ended", () => {
    render(<BenefitsBento promoActive={false} />);

    expect(screen.queryByRole("heading", { level: 3, name: "0% de comisión por cada venta." })).not.toBeInTheDocument();
    expect(screen.queryByText("TIENDAS FUNDADORAS")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
  });
});
