import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FoundersPackage } from "@/components/sellers/founders-package";
import { SellerProgram } from "@/components/sellers/seller-program";

afterEach(cleanup);

describe("FoundersPackage", () => {
  it("is the #fundadoras anchor, named by its heading", () => {
    render(<FoundersPackage />);

    expect(screen.getByRole("region", { name: "Lo que te llevas por publicar primero." })).toHaveAttribute(
      "id",
      "fundadoras",
    );
  });

  it("titles each perk so a screen reader hears the figure with it", () => {
    render(<FoundersPackage />);

    const section = screen.getByRole("region", { name: "Lo que te llevas por publicar primero." });
    expect(within(section).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Así luce una tienda fundadora.",
      "50 productos en vivo",
      "Insignia fundadora",
      "0% comisión fija 12 meses",
      "90 días en la portada",
    ]);
    expect(screen.getByText(/Registrarte no aparta un lugar/)).toHaveTextContent(
      "Para las primeras 100 tiendas que publiquen 8 productos en sus primeros 7 días.",
    );
  });

  it("keeps the store mock out of the accessibility tree", () => {
    render(<FoundersPackage />);

    expect(screen.getByText("Tu tienda").closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("leaves /vender once the promotion has ended", () => {
    render(<SellerProgram founders={{ open: false, taken: 100, cap: 100 }} />);

    expect(document.getElementById("fundadoras")).toBeNull();
  });
});
