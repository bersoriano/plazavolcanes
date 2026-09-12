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
    render(
      <PremiumScope premium={false}>
        <p>Casa Niebla</p>
      </PremiumScope>,
    );

    expect(screen.getByText("Casa Niebla").closest("[data-theme]")).toBeNull();
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
