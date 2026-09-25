import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerPitch } from "@/components/home/seller-pitch";

afterEach(cleanup);

describe("SellerPitch", () => {
  it("offers one concise path to open a store and one path to seller details", () => {
    render(<SellerPitch />);

    const pitch = screen.getByRole("region", { name: "Vende en Plaza Volcanes." });

    expect(within(pitch).getByRole("heading", { name: "Vende en Plaza Volcanes." }))
      .toBeInTheDocument();
    expect(pitch).toHaveTextContent(
      "Las primeras 100 tiendas que se registren durante los primeros tres meses pueden publicar gratis y no pagan comisión por cada artículo vendido.",
    );
    expect(within(pitch).getByRole("link", { name: "Crear mi tienda gratis" })).toHaveAttribute(
      "href",
      "/registro?vender=1",
    );
    expect(within(pitch).getByRole("link", { name: "Conoce cómo funciona" })).toHaveAttribute(
      "href",
      "/vender?desde=pitch",
    );
  });

  it("names the three promises the landing page leads with", () => {
    render(<SellerPitch />);

    const pitch = screen.getByRole("region", { name: "Vende en Plaza Volcanes." });

    expect(
      within(pitch)
        .getAllByRole("listitem")
        .map((promise) => promise.textContent),
    ).toEqual([
      "Sin retenciones ni comisiones",
      "Transfiere tu reputación",
      "Tu catálogo en un solo lugar",
    ]);
  });

  it("leaves ordered setup steps and trust-tier details to the seller page", () => {
    render(<SellerPitch />);

    const pitch = screen.getByRole("region", { name: "Vende en Plaza Volcanes." });

    // The promises are a list; the ordered steps and the ladder are not.
    expect(pitch).not.toHaveTextContent(/Paso 1|Paso 2|Paso 3/);
    expect(pitch).not.toHaveTextContent(/Estándar|Confiable|Mejor valorada/);
    expect(pitch).not.toHaveTextContent(/productos publicados/);
  });

  it("sets the plaza's name in italic lime", () => {
    render(<SellerPitch />);

    const emphasis = screen.getByRole("heading", { level: 2 }).querySelector("em");
    expect(emphasis).toHaveTextContent("Plaza Volcanes.");
    expect(emphasis).toHaveClass("italic", "text-accent");
  });

  it("shows the $0.00 receipt as a hidden illustration with a spoken summary", () => {
    render(<SellerPitch />);

    const receipt = screen.getByTestId("seller-pitch-receipt");
    expect(receipt).toHaveAttribute("aria-hidden", "true");
    expect(receipt).toHaveTextContent("Comisión Plaza Volcanes");
    expect(receipt).toHaveTextContent("$0.00");
    expect(receipt.querySelectorAll("a, button, input, select, [tabindex]")).toHaveLength(0);
    expect(screen.getByText(/^Ejemplo: vendes un artículo/)).toHaveClass("sr-only");
  });

  it("puts the receipt between the promises and the buttons", () => {
    render(<SellerPitch />);

    const list = screen.getByRole("list");
    const receipt = screen.getByTestId("seller-pitch-receipt");
    const cta = screen.getByRole("link", { name: "Crear mi tienda gratis" });
    expect(list.compareDocumentPosition(receipt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(receipt.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
