import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrustStrip } from "@/components/home/trust-strip";

afterEach(cleanup);

describe("TrustStrip", () => {
  it("promises no arbitration, because the platform holds no money", () => {
    const { container } = render(<TrustStrip />);

    expect(container.textContent).not.toMatch(/arbitraje/i);
  });

  it("links the claims process instead of describing an outcome", () => {
    render(<TrustStrip />);

    expect(
      screen.getByRole("link", { name: /quejas y aclaraciones/i }),
    ).toHaveAttribute("href", "/quejas-y-aclaraciones");
  });
});
