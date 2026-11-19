import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HeroCollage } from "@/components/home/landing/hero-collage";

afterEach(cleanup);

describe("HeroCollage", () => {
  it("stands the seller portrait behind the rules card instead of product tiles", () => {
    const { container } = render(<HeroCollage latest={null} />);

    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(1);
    expect(decodeURIComponent(images[0].getAttribute("src") ?? "")).toContain("/mexican-woman.jpg");
    expect(images[0]).toHaveAttribute("alt", "");
  });

  it("draws the seller's own rules: price, how they get paid, no commission", () => {
    const { container } = render(<HeroCollage latest={null} />);

    const picture = container.querySelector("[aria-hidden='true']");
    expect(picture?.textContent).toContain("Reglas de mi tienda");
    expect(picture?.textContent).toContain("Cómo cobro");
    expect(picture?.textContent).toContain("Directo");
    expect(picture?.textContent).toContain("Tú pones el precio");
    expect(picture?.textContent).not.toContain("Pedido confirmado");
  });

  it("tells screen readers the same rules the hidden picture shows", () => {
    const { container } = render(<HeroCollage latest={null} />);

    expect(container.querySelector(".sr-only")).toHaveTextContent(
      "Ejemplo de las reglas de una tienda: tú pones el precio, $1,999.00; cobras directo; comisión Plaza Volcanes $0.00; tú recibes $1,999.00.",
    );
  });
});
