import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerStepsShowcase } from "@/components/home/landing/seller-steps-showcase";

afterEach(cleanup);

describe("SellerStepsShowcase", () => {
  it("is the #pasos anchor, named by its heading", () => {
    render(<SellerStepsShowcase />);

    expect(screen.getByRole("region", { name: "Tres pasos y ya vendes." })).toHaveAttribute("id", "pasos");
  });

  it("lists the three steps in order as card headings", () => {
    render(<SellerStepsShowcase />);

    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((step) => within(step).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Crea tu tienda gratis",
      "Publica tus productos",
      "Acepta y cobra directo",
    ]);
  });

  it("keeps the illustrations out of the accessibility tree and the tab order", () => {
    const { container } = render(<SellerStepsShowcase />);

    const snippet = screen.getByText("NOMBRE DE TU TIENDA");
    expect(snippet.closest("[aria-hidden='true']")).not.toBeNull();
    expect(container.querySelectorAll("[aria-hidden='true'] :is(a, button, input, [tabindex])")).toHaveLength(0);
  });

  it("sends both copies of the call to action to seller signup", () => {
    render(<SellerStepsShowcase />);

    for (const link of screen.getAllByRole("link", { name: "Crear mi tienda gratis" })) {
      expect(link).toHaveAttribute("href", "/registro?vender=1");
    }
  });
});
