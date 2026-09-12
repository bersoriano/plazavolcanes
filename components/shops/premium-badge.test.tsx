import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PremiumBadge } from "@/components/shops/premium-badge";

afterEach(cleanup);

describe("PremiumBadge", () => {
  it("names the distinction for sighted and assistive readers alike", () => {
    render(<PremiumBadge />);

    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tienda Premium" })).toBeInTheDocument();
  });

  it("says who grants the distinction, so it is not read as a measured metric", () => {
    render(<PremiumBadge />);

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      /Plaza Volcanes distingue a esta tienda/,
    );
  });

  it("drops the explanation where there is no room for it", () => {
    render(<PremiumBadge showDetails={false} />);

    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
