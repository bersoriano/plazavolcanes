import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders an accessible aubergine primary action", () => {
    render(<Button>Crear tienda</Button>);

    const button = screen.getByRole("button", { name: "Crear tienda" });
    expect(button).toHaveClass("bg-[var(--brand)]");
    expect(button).toHaveClass("text-white");
  });

  it("forwards disabled state", () => {
    render(<Button disabled>Publicando</Button>);

    expect(
      screen.getByRole("button", { name: "Publicando" }),
    ).toBeDisabled();
  });
});
