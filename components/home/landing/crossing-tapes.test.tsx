import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CrossingTapes } from "@/components/home/landing/crossing-tapes";

afterEach(cleanup);

/** Text a screen reader reaches: everything outside an aria-hidden subtree. */
function exposedTexts(container: HTMLElement) {
  return [...container.querySelectorAll("span, em")]
    .filter((node) => !node.closest("[aria-hidden='true']") && node.children.length === 0)
    .map((node) => node.textContent);
}

describe("CrossingTapes", () => {
  it("exposes each promise and each category once, however often the tapes repeat them", () => {
    const { container } = render(<CrossingTapes categories={["Electrónica", "Moda"]} />);

    expect(exposedTexts(container)).toEqual([
      "Sin retenciones",
      "ni comisiones",
      "Pago directo",
      "todo por escrito",
      "100% mexicana",
      "Electrónica",
      "Moda",
    ]);
  });

  it("repeats a short category list until the tape is full", () => {
    const { container } = render(<CrossingTapes categories={["Moda"]} />);

    expect([...container.querySelectorAll("span")].filter((node) => node.textContent === "Moda").length).toBeGreaterThan(4);
  });

  it("sets the promises in alternating italics", () => {
    const { container } = render(<CrossingTapes categories={[]} />);

    expect([...container.querySelectorAll("em")].slice(0, 2).map((node) => node.textContent)).toEqual([
      "ni comisiones",
      "todo por escrito",
    ]);
  });

  it("runs the two tapes in opposite directions", () => {
    const { container } = render(<CrossingTapes categories={["Moda"]} />);

    expect(container.querySelector(".animate-marquee")).not.toBeNull();
    expect(container.querySelector(".animate-marquee-reverse")).not.toBeNull();
  });
});
