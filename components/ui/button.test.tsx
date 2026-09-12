import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders an accessible aubergine primary action", () => {
    render(<Button>Crear tienda</Button>);

    const button = screen.getByRole("button", { name: "Crear tienda" });
    expect(button).toHaveClass("bg-[var(--brand)]");
    // The label colour follows a token, so a themed scope can darken it where
    // the brand colour is light enough to swallow white text.
    expect(button).toHaveClass("text-on-brand");
  });

  it("renders a secondary action on a tokenised raised surface", () => {
    render(<Button variant="secondary">Cancelar</Button>);

    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass("bg-surface-raised");
  });

  it("forwards disabled state", () => {
    render(<Button disabled>Publicando</Button>);

    expect(
      screen.getByRole("button", { name: "Publicando" }),
    ).toBeDisabled();
  });
});
