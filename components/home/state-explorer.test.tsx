import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StateExplorer } from "@/components/home/state-explorer";

afterEach(cleanup);

describe("StateExplorer", () => {
  it("links each state with published products to its own page", () => {
    render(
      <StateExplorer
        counts={[
          { code: "MX-JAL", count: 24 },
          { code: "MX-OAX", count: 9 },
        ]}
      />,
    );

    const region = screen.getByRole("region", { name: "Explora por estado." });
    const jalisco = within(region).getByRole("link", { name: /Jalisco/ });

    expect(jalisco).toHaveAttribute("href", "/estado/jalisco");
    expect(jalisco).toHaveTextContent("24");
    expect(within(region).getByRole("link", { name: /Oaxaca/ })).toHaveAttribute(
      "href",
      "/estado/oaxaca",
    );
  });

  it("renders nothing while no state has published products", () => {
    const { container } = render(<StateExplorer counts={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("skips codes that are not supported states", () => {
    render(<StateExplorer counts={[{ code: "US-CA", count: 5 }, { code: "MX-JAL", count: 1 }]} />);

    const region = screen.getByRole("region", { name: "Explora por estado." });
    expect(within(region).getAllByRole("link")).toHaveLength(1);
  });

  it("labels each count as products, singular for one", () => {
    render(<StateExplorer counts={[{ code: "MX-JAL", count: 4 }, { code: "MX-OAX", count: 1 }]} />);

    expect(screen.getByRole("link", { name: /Jalisco/ })).toHaveTextContent("4 productos");
    expect(screen.getByRole("link", { name: /Oaxaca/ })).toHaveTextContent("1 producto");
    expect(screen.getByRole("link", { name: /Oaxaca/ })).not.toHaveTextContent("1 productos");
  });
});
