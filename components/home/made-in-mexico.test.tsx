import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MadeInMexico } from "@/components/home/made-in-mexico";

afterEach(cleanup);

describe("MadeInMexico", () => {
  it("states the plaza's origin as the section's heading", () => {
    render(<MadeInMexico />);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Plaza Volcanes es una plataforma 100% Mexicana.");
    expect(
      screen.getByRole("region", { name: "Plaza Volcanes es una plataforma 100% Mexicana." }),
    ).toBeInTheDocument();
  });

  it("sets the closing phrase in italic purple", () => {
    render(<MadeInMexico />);

    const emphasis = screen.getByRole("heading", { level: 2 }).querySelector("em");
    expect(emphasis).toHaveTextContent("100% Mexicana.");
    expect(emphasis).toHaveClass("italic", "text-brand");
  });

  it("keeps the volcano mark decorative", () => {
    const { container } = render(<MadeInMexico />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
