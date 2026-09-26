import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerProgram } from "@/components/sellers/seller-program";
import { FOUNDERS_FALLBACK } from "@/lib/launch";
import { getTrustTierMarker } from "@/lib/trust-tiers";

afterEach(cleanup);

const HERO = "Abre tu tienda gratis y quédate con cada peso.";

describe("SellerProgram", () => {
  it("carries the three promises as labelled regions under a single h1", () => {
    render(<SellerProgram founders={FOUNDERS_FALLBACK} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    for (const region of [
      HERO,
      "Hecho para quien vende por su cuenta.",
      "Tu tienda lista en tres pasos.",
      "Cuanto mejor atiendes, más publicas.",
      "Lo que te estás preguntando.",
      "Sé una de las primeras 100 tiendas.",
    ]) {
      expect(screen.getByRole("region", { name: region })).toBeInTheDocument();
    }

    const benefits = screen.getByRole("region", { name: "Hecho para quien vende por su cuenta." });
    expect(within(benefits).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Tu cliente te paga directo a ti.",
      "Muestra la confianza que ya ganaste.",
    ]);
    // The catalogue keeps a section of its own, with its current copy.
    const catalog = screen.getByRole("region", { name: "Maneja tu catálogo de productos aquí." });
    expect(catalog).toHaveAttribute("id", "catalogo");
  });

  it("numbers the ordered steps to opening a store", () => {
    render(<SellerProgram founders={FOUNDERS_FALLBACK} />);

    const steps = within(
      screen.getByRole("region", { name: "Tu tienda lista en tres pasos." }),
    ).getAllByRole("listitem");

    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Paso 1");
    expect(steps[0]).toHaveTextContent("Crea tu tienda");
    expect(steps[1]).toHaveTextContent("Paso 2");
    expect(steps[1]).toHaveTextContent("Trae tu reputación");
    expect(steps[2]).toHaveTextContent("Paso 3");
    expect(steps[2]).toHaveTextContent("Publica y recibe pedidos");
  });

  it("keeps the publication ladder every tier sets", () => {
    render(<SellerProgram founders={FOUNDERS_FALLBACK} />);

    const tiers = screen.getByRole("region", { name: "Cuanto mejor atiendes, más publicas." });

    // The limits come from the tiers the plaza enforces, not from copy.
    expect(within(tiers).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(
      (["standard", "reliable", "top_rated"] as const).map((tier) => getTrustTierMarker(tier).label),
    );
    for (const tier of ["standard", "reliable", "top_rated"] as const) {
      expect(within(tiers).getByText((_, element) => element?.tagName === "P" && element.textContent === `Hasta ${getTrustTierMarker(tier).listingLimit} productos`)).toBeInTheDocument();
    }
    expect(within(tiers).getByText("Tiendas fundadoras: 50 desde el día uno")).toBeInTheDocument();
  });

  it("sends every call to action to the same registration link", () => {
    render(<SellerProgram founders={FOUNDERS_FALLBACK} />);

    const ctas = screen.getAllByRole("link", { name: "Crear mi tienda gratis" });

    expect(ctas.length).toBeGreaterThanOrEqual(3);
    for (const cta of ctas) expect(cta.getAttribute("href")).toMatch(/^\/registro\?vender=1(&desde=[a-z]+)?$/);

    expect(screen.getByRole("link", { name: "¿Ya tienes cuenta? Ingresa" })).toHaveAttribute(
      "href",
      "/ingresar?intent=vender",
    );
    expect(screen.getByRole("link", { name: "Términos para vendedores" })).toHaveAttribute(
      "href",
      "/terminos-vendedores",
    );
    expect(screen.getByRole("link", { name: "Ver cómo funciona" })).toHaveAttribute(
      "href",
      "#pasos",
    );
  });

  it("describes its illustrations in words and gives them nothing to operate", () => {
    const { container } = render(<SellerProgram founders={FOUNDERS_FALLBACK} />);

    expect(
      screen.getByText(/vendes un artículo en \$1,999\.00 y recibes \$1,999\.00/),
    ).toBeInTheDocument();
    expect(screen.getByText(/tres publicados y uno guardado como borrador/)).toBeInTheDocument();

    // A picture of the panel, not the panel: nothing inside may take focus.
    expect(
      container.querySelectorAll(
        '[aria-hidden="true"] a, [aria-hidden="true"] button, [aria-hidden="true"] input',
      ),
    ).toHaveLength(0);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows no founders count until real data arrives", () => {
    render(<SellerProgram founders={FOUNDERS_FALLBACK} />);

    expect(screen.getByText("Lanzamiento · Primeras 100 tiendas")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/Lugares ocupados/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lugares para tiendas fundadoras/)).not.toBeInTheDocument();
  });

  it("states the direct-sale limits without claiming protection it cannot give", () => {
    render(<SellerProgram founders={FOUNDERS_FALLBACK} />);

    const hero = screen.getByRole("region", { name: HERO });

    expect(hero).toHaveTextContent("Sin retenciones ni comisión en pago directo.");
    expect(document.body).toHaveTextContent(
      "Directo de tu cliente. Acuerdan juntos el método de pago y Plaza Volcanes no procesa ni retiene ese dinero, así que no hay retenciones.",
    );
    expect(document.body).not.toHaveTextContent(
      /compra protegida|pago seguro|garantizamos|garantía|reembolso garantizado/i,
    );
  });
});
