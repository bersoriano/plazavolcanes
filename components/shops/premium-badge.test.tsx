import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PremiumBadge } from "@/components/shops/premium-badge";

afterEach(cleanup);

describe("PremiumBadge", () => {
  it("names the distinction for sighted and assistive readers alike", () => {
    render(<PremiumBadge />);

    expect(screen.getByTestId("premium-badge")).toHaveTextContent("Premium");
    expect(screen.getByTestId("premium-badge")).toHaveTextContent(/Tienda Premium/);
  });

  it("carries who grants it, so the badge alone is never read as a measurement", () => {
    render(<PremiumBadge />);

    expect(screen.getByTestId("premium-badge")).toHaveTextContent(
      /Distinción otorgada por Plaza Volcanes/,
    );
  });

  it("hangs no meaning on a hover tooltip", () => {
    render(<PremiumBadge />);

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByTestId("premium-badge")).not.toHaveAttribute("title");
  });

  it("promises nothing the platform cannot evidence", () => {
    render(<PremiumBadge />);

    expect(screen.getByTestId("premium-badge").textContent).not.toMatch(
      /verificad|garantiz|protegid|asegurad/i,
    );
  });

  it("frames itself in theme tokens, not literal colours", () => {
    render(<PremiumBadge />);

    expect(screen.getByTestId("premium-badge")).toHaveClass(
      "bg-premium-ink",
      "text-premium-gold",
    );
    expect(screen.getByTestId("premium-badge").className).not.toMatch(/\[#/);
  });

  it("brings no outer margin, so it centres on whatever row it joins", () => {
    render(<PremiumBadge />);

    expect(screen.getByTestId("premium-badge").className).not.toMatch(/(^|\s)m[tyb]?-/);
  });

  it("takes the spacing its caller asks for", () => {
    render(<PremiumBadge className="mt-4" />);

    expect(screen.getByTestId("premium-badge")).toHaveClass("mt-4");
  });
});
