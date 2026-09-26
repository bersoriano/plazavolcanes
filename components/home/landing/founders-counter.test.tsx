import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FoundersCounter } from "@/components/home/landing/founders-counter";

afterEach(cleanup);

describe("FoundersCounter", () => {
  it("names the offer and shows no bar without a count", () => {
    render(<FoundersCounter />);

    expect(screen.getByText("Primeras 100 tiendas")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows the spots left and fills the bar once a count arrives", () => {
    render(<FoundersCounter spotsTaken={38} />);

    expect(screen.getByText(/de 100 lugares disponibles/)).toHaveTextContent("62 de 100 lugares disponibles");
    const bar = screen.getByRole("progressbar", { name: "Lugares de tiendas fundadoras ocupados" });
    expect(bar).toHaveAttribute("aria-valuenow", "38");
    expect(bar.firstElementChild).toHaveStyle({ width: "38%" });
  });
});
