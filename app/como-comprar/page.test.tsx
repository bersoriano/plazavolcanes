import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import HowToBuyPage, { metadata } from "@/app/como-comprar/page";

afterEach(cleanup);

describe("/como-comprar", () => {
  it("carries the buying guide as the page's single h1 and the checks before a purchase", () => {
    render(<HowToBuyPage />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Cómo comprar en la plaza.");
    expect(screen.getByRole("region", { name: "Antes de acordar una compra" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver productos" })).toHaveAttribute("href", "/explorar");
  });

  it("is its own canonical page", () => {
    expect(metadata.alternates).toEqual({ canonical: "/como-comprar" });
  });

  it("names who runs the plaza in its structured data", () => {
    render(<HowToBuyPage />);

    const script = document.querySelector('script[type="application/ld+json"]');
    const graph = JSON.parse(script?.textContent ?? "")["@graph"];

    expect(graph.map((node: { "@type": string }) => node["@type"])).toEqual(["Organization", "Service"]);
  });
});
