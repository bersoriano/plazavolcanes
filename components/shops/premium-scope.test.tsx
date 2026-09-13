import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PremiumScope } from "@/components/shops/premium-scope";

afterEach(cleanup);

describe("PremiumScope", () => {
  it("opens a premium theme scope around a distinguished shop", () => {
    render(
      <PremiumScope premium>
        <p>Casa Premium</p>
      </PremiumScope>,
    );

    const scope = screen.getByText("Casa Premium").closest("[data-theme]");
    expect(scope).toHaveAttribute("data-theme", "premium");
    expect(scope).toHaveClass("bg-background");
  });

  it("leaves an ordinary shop in the ordinary theme", () => {
    const { container } = render(
      <PremiumScope premium={false}>
        <p>Casa Niebla</p>
      </PremiumScope>,
    );

    expect(screen.getByText("Casa Niebla").closest("[data-theme]")).toBeNull();
    // No wrapper element at all, not merely an unstyled one: the paragraph
    // itself is the container's first (and only) child.
    expect(container.firstChild).toBe(screen.getByText("Casa Niebla"));
    expect(container.querySelector("div")).toBeNull();
  });

  it("keeps extra layout classes the caller needs on the scope", () => {
    render(
      <PremiumScope className="pb-10" premium>
        <p>Casa Premium</p>
      </PremiumScope>,
    );

    expect(screen.getByText("Casa Premium").closest("[data-theme]")).toHaveClass("pb-10");
  });
});
