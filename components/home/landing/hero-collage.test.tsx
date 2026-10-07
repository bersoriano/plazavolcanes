import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HeroCollage } from "@/components/home/landing/hero-collage";

afterEach(cleanup);

describe("HeroCollage", () => {
  it("stands the seller portrait behind the receipt instead of product tiles", () => {
    const { container } = render(<HeroCollage latest={null} />);

    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(1);
    expect(decodeURIComponent(images[0].getAttribute("src") ?? "")).toContain("/mexican-woman.jpg");
    expect(images[0]).toHaveAttribute("alt", "");
    expect(container.textContent).toContain("Pedido confirmado");
  });
});
