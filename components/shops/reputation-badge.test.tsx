import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PremiumBadge } from "@/components/shops/premium-badge";
import { ReputationBadge } from "@/components/shops/reputation-badge";

afterEach(cleanup);

describe("ReputationBadge", () => {
  it("says nothing for the tier every shop starts in", () => {
    const { container } = render(<ReputationBadge tier="standard" />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Estándar/)).toBeNull();
  });

  it("names a tier the shop earned", () => {
    render(<ReputationBadge tier="reliable" />);

    expect(screen.getByTestId("reputation-badge")).toHaveTextContent("Confiable");
  });

  it("explains that the tier is measured, not granted", () => {
    render(<ReputationBadge tier="top_rated" />);

    expect(screen.getByTestId("reputation-badge")).toHaveTextContent(/Reputación medida/);
  });

  it("never shares a fill with the Premium badge beside it", () => {
    render(
      <>
        <ReputationBadge tier="reliable" />
        <PremiumBadge />
      </>,
    );

    const fill = (element: HTMLElement) =>
      [...element.classList].filter((name) => name.startsWith("bg-"));

    expect(fill(screen.getByTestId("reputation-badge"))).not.toEqual(
      fill(screen.getByTestId("premium-badge")),
    );
    expect(screen.getByTestId("reputation-badge")).toHaveClass("bg-trust-tier-fill");
    expect(screen.getByTestId("reputation-badge")).not.toHaveClass("bg-premium-ink");
  });
});
