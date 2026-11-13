import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FinalCta } from "@/components/home/landing/final-cta";

afterEach(cleanup);

describe("FinalCta", () => {
  it("closes on the founders offer with both ways forward", () => {
    render(<FinalCta />);

    const section = screen.getByRole("region", { name: "Sé de las primeras 100 tiendas." });
    expect(within(section).getByText("ÚLTIMOS LUGARES FUNDADORES")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Abrir mi tienda gratis" })).toHaveAttribute(
      "href",
      "/registro?vender=1",
    );
    expect(within(section).getByRole("link", { name: "Conoce cómo funciona" })).toHaveAttribute("href", "#pasos");
    expect(within(section).getByText("Plaza Volcanes es una plataforma 100% mexicana 🇲🇽")).toBeInTheDocument();
  });
});
