import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FoundersCta } from "@/components/sellers/founders-cta";

afterEach(cleanup);

describe("FoundersCta", () => {
  it("hides the counter, not the invitation, when there is no count", () => {
    for (const spotsTaken of [undefined, null, Number.NaN, -3]) {
      render(<FoundersCta spotsTaken={spotsTaken} />);

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.queryByText(/lugares libres/)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Crear mi tienda gratis" })).toHaveAttribute(
        "href",
        "/registro?vender=1&desde=final",
      );
      expect(screen.getByRole("link", { name: "¿Ya tienes cuenta? Ingresa" })).toBeInTheDocument();

      cleanup();
    }
  });

  it("shows the spots left against the cap", () => {
    render(<FoundersCta spotsTaken={2} />);

    const bar = screen.getByRole("progressbar", { name: "Lugares de tiendas fundadoras ocupados" });
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("98")).toBeInTheDocument();
    expect(screen.getByText("de 100 lugares libres")).toBeInTheDocument();
    // Two spots out of a hundred still has to be visible as a sliver.
    expect(bar.firstElementChild).toHaveStyle({ width: "2%" });
  });

  it("never reports more than the hundred spots that exist", () => {
    render(<FoundersCta spotsTaken={137} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("routes by viewer and only invites a visitor to sign in", () => {
    const { rerender } = render(<FoundersCta viewer="no-shop" />);
    expect(screen.getByRole("link", { name: "Crear mi tienda gratis" })).toHaveAttribute(
      "href",
      "/panel/tiendas/nueva?desde=final",
    );
    expect(screen.queryByRole("link", { name: "¿Ya tienes cuenta? Ingresa" })).not.toBeInTheDocument();

    rerender(<FoundersCta viewer="owner" />);
    expect(screen.getByRole("link", { name: "Ir a mi panel" })).toHaveAttribute("href", "/panel");
  });

  it("marks itself for the sticky bar", () => {
    const { container } = render(<FoundersCta />);

    expect(container.querySelector("[data-final-cta]")).not.toBeNull();
  });
});
