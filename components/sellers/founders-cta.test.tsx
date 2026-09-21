import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FoundersCta } from "@/components/sellers/founders-cta";

afterEach(cleanup);

describe("FoundersCta", () => {
  it("hides the counter, not the invitation, when there is no count", () => {
    for (const spotsTaken of [undefined, null, Number.NaN, -3]) {
      render(<FoundersCta spotsTaken={spotsTaken} />);

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.queryByText("Lugares ocupados")).not.toBeInTheDocument();
      expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Crear mi tienda gratis" })).toHaveAttribute(
        "href",
        "/registro?vender=1",
      );
      expect(screen.getByRole("link", { name: "¿Ya tienes cuenta? Ingresa" })).toBeInTheDocument();

      cleanup();
    }
  });

  it("reports the spots taken against the cap", () => {
    render(<FoundersCta spotsTaken={2} />);

    const bar = screen.getByRole("progressbar", {
      name: "Lugares de tiendas fundadoras ocupados",
    });

    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("Lugares ocupados")).toBeInTheDocument();
    expect(screen.getByText(/Quedan 98 lugares para tiendas fundadoras\./)).toBeInTheDocument();
    // Two spots out of a hundred still has to be visible as a sliver.
    expect(bar.firstElementChild).toHaveStyle({ width: "2%" });
  });

  it("paints nothing when the first spot is still open", () => {
    render(<FoundersCta spotsTaken={0} />);

    const bar = screen.getByRole("progressbar");

    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar.firstElementChild).toHaveStyle({ width: "0%" });
    expect(screen.getByText(/Quedan 100 lugares para tiendas fundadoras\./)).toBeInTheDocument();
  });

  it("never reports more than the hundred spots that exist", () => {
    render(<FoundersCta spotsTaken={137} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText(/Quedan 0 lugares para tiendas fundadoras\./)).toBeInTheDocument();
  });
});
