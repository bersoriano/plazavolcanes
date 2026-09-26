import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerHero } from "@/components/sellers/seller-hero";

afterEach(cleanup);

describe("SellerHero", () => {
  it("counts the founding spots left while the promotion runs", () => {
    render(<SellerHero spotsTaken={38} />);

    expect(screen.getByText("Lanzamiento · Primeras 100 tiendas")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Lugares de tiendas fundadoras ocupados" })).toHaveAttribute(
      "aria-valuenow",
      "38",
    );
    expect(
      screen.getByText(
        "Publica 8 productos en tus primeros 7 días y gana tu lugar. Registrarte no aparta un lugar: se gana publicando.",
      ),
    ).toBeInTheDocument();
  });

  it("routes the CTA by who is looking", () => {
    const { rerender } = render(<SellerHero viewer="signed-out" />);
    expect(screen.getByRole("link", { name: "Crear mi tienda gratis" })).toHaveAttribute(
      "href",
      "/registro?vender=1&desde=hero",
    );

    rerender(<SellerHero viewer="no-shop" />);
    expect(screen.getByRole("link", { name: "Crear mi tienda gratis" })).toHaveAttribute(
      "href",
      "/panel/tiendas/nueva?desde=hero",
    );

    rerender(<SellerHero viewer="owner" />);
    expect(screen.getByRole("link", { name: "Ir a mi panel" })).toHaveAttribute("href", "/panel");
  });

  it("tells a founder they already are one in place of the counter", () => {
    render(<SellerHero isFounder spotsTaken={38} viewer="owner" />);

    expect(screen.getByText("Ya eres tienda fundadora")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("drops the founders offer once the promotion has ended", () => {
    const { container } = render(<SellerHero promoActive={false} spotsTaken={100} />);

    expect(screen.getByText("Publica gratis · 0% comisión")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Primeras 100|fundadora|12 meses/i);
    expect(screen.getByText("25 productos gratis")).toBeInTheDocument();
  });

  it("keeps the collage out of the accessibility tree and states its facts instead", () => {
    render(<SellerHero />);

    expect(screen.getByText("Pedido confirmado").closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByText(/vendes un artículo en \$1,999\.00 y recibes \$1,999\.00/)).toBeInTheDocument();
  });

  it("has a single h1 that reads as one sentence", () => {
    render(<SellerHero />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Abre tu tienda gratis y quédate con cada peso.",
    );
  });
});
