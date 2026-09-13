import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PremiumBadge } from "@/components/shops/premium-badge";
import { TrustTierBadge } from "@/components/shops/trust-tier-badge";

afterEach(cleanup);

function tierPill() {
  return screen.getByText(/Nivel/).closest("div") as HTMLElement;
}

describe("TrustTierBadge", () => {
  it("fills its pill from the tier token, which a premium scope tints gold", () => {
    render(<TrustTierBadge showDetails={false} tier="standard" />);

    expect(tierPill()).toHaveClass("bg-trust-tier-fill");
    expect(tierPill()).not.toHaveClass("bg-accent/40");
  });

  it("never shares a fill with the Premium badge beside it", () => {
    render(
      <>
        <TrustTierBadge showDetails={false} tier="standard" />
        <PremiumBadge showDetails={false} />
      </>,
    );

    const fill = (element: HTMLElement) =>
      [...element.classList].filter((name) => name.startsWith("bg-"));
    const premium = screen.getByRole("group", { name: "Tienda Premium" });

    expect(fill(tierPill())).not.toEqual(fill(premium));
    expect(tierPill()).not.toHaveClass("bg-premium-ink");
  });
});
