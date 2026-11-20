import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HeroCollage } from "@/components/home/landing/hero-collage";

afterEach(cleanup);

describe("HeroCollage", () => {
  it("stands the seller portrait behind the rules card instead of product tiles", () => {
    const { container } = render(<HeroCollage latest={null} />);

    // The seasonal decoration (components/navidad) is not a picture of the plaza.
    const images = [...container.querySelectorAll("img")].filter((img) => !img.closest(".nv"));
    expect(images).toHaveLength(1);
    expect(decodeURIComponent(images[0].getAttribute("src") ?? "")).toContain("/mexican-woman.jpg");
    expect(images[0]).toHaveAttribute("alt", "");
  });

  it("blends the portrait into the hero instead of framing it as a card", () => {
    const { container } = render(<HeroCollage latest={null} />);

    const portrait = container.querySelector("img");
    const frame = portrait?.parentElement;
    // Feathered edges and a darken blend: the studio backdrop takes the hero's
    // own colour and glow, and no edge, corner or shadow outlines a box.
    expect(frame).not.toHaveClass("shadow-float");
    expect(frame).not.toHaveClass("cq-r");
    expect(frame).not.toHaveClass("bg-photo-backdrop");
    // Mask, brightness and blend all sit on the image itself: on the frame
    // the mask would make it an isolated group, and the blend would only
    // ever see transparency.
    expect(frame).not.toHaveClass("portrait-blend");
    expect(portrait).toHaveClass("portrait-blend");
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
