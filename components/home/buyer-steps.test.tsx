import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BuyerSteps } from "@/components/home/buyer-steps";

afterEach(cleanup);

describe("BuyerSteps", () => {
  it("names the section after its heading, with the italic accent", () => {
    render(<BuyerSteps catalogHref="#catalogo" />);

    const region = screen.getByRole("region", { name: "Cómo comprar en la plaza." });
    expect(within(region).getByRole("heading", { level: 2 }).querySelector("em")).toHaveTextContent(
      "en la plaza.",
    );
    expect(region).toHaveTextContent("No necesitas cuenta para mirar.");
  });

  it("lists the three steps in order", () => {
    render(<BuyerSteps catalogHref="#catalogo" />);

    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => within(step).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Explora y compara",
      "Solicita tu pedido",
      "Confirma y reseña",
    ]);
    steps.forEach((step, index) => expect(step).toHaveTextContent(`PASO ${index + 1}`));
  });

  it("sends the reader to the catalogue", () => {
    render(<BuyerSteps catalogHref="#catalogo" />);

    expect(screen.getByRole("link", { name: "Ver productos" })).toHaveAttribute("href", "#catalogo");
  });
});
