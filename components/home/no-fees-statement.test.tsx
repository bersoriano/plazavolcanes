import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NoFeesStatement } from "@/components/home/no-fees-statement";

afterEach(cleanup);

describe("NoFeesStatement", () => {
  it("states the promise as the section's heading", () => {
    render(<NoFeesStatement />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Sin retenciones Ni Comisiones",
    );
    expect(
      screen.getByRole("region", { name: "Sin retenciones Ni Comisiones" }),
    ).toBeInTheDocument();
  });

  it("sets the closing phrase in italic purple, centered", () => {
    render(<NoFeesStatement />);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveClass("text-center");
    const emphasis = heading.querySelector("em");
    expect(emphasis).toHaveTextContent("Ni Comisiones");
    expect(emphasis).toHaveClass("italic", "text-brand");
  });
});
