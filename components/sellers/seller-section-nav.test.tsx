import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SellerSectionNav } from "@/components/sellers/seller-section-nav";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let notify: Callback = () => {};

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: Callback) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function bar() {
  return screen.getByRole("navigation", { name: "Secciones de Vender" });
}

function linkPairs() {
  return within(bar()).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]);
}

describe("SellerSectionNav", () => {
  it("lists the page's sections in the order they appear", () => {
    render(<SellerSectionNav promoActive />);

    expect(linkPairs()).toEqual([
      ["Fundadoras", "#fundadoras"],
      ["Beneficios", "#beneficios"],
      ["Compara", "#compara"],
      ["Catálogo", "#catalogo"],
      ["Cómo empezar", "#pasos"],
      ["Niveles", "#niveles"],
      ["Preguntas", "#preguntas"],
    ]);
  });

  it("leaves the founders package out once the promotion closes", () => {
    render(<SellerSectionNav promoActive={false} />);

    expect(linkPairs().map(([label]) => label)).not.toContain("Fundadoras");
    expect(linkPairs()).toHaveLength(6);
  });

  it("is the page's one fixed strip, marked for the header to step aside", () => {
    render(<SellerSectionNav promoActive />);

    // vender.css un-sticks the header while this marker is on the page.
    expect(bar()).toHaveAttribute("data-seller-section-nav");
    expect(bar()).toHaveClass("sticky", "top-0");
  });

  it("names the page beside its sections once there is room", () => {
    render(<SellerSectionNav promoActive />);

    expect(within(bar()).getByText("Vender en Plaza Volcanes")).toHaveClass("hidden", "lg:block");
  });

  it("keeps every section link a 44px target", () => {
    render(<SellerSectionNav promoActive />);

    for (const link of within(bar()).getAllByRole("link")) {
      expect(link).toHaveClass("min-h-11");
    }
  });

  it("marks the section being read and moves the mark as the reader scrolls", () => {
    document.body.innerHTML = '<section id="niveles"></section><section id="preguntas"></section>';
    const niveles = document.getElementById("niveles")!;
    const preguntas = document.getElementById("preguntas")!;
    render(<SellerSectionNav promoActive />, { container: document.body.appendChild(document.createElement("div")) });

    // At the hero no section crosses the middle of the screen yet.
    for (const link of within(bar()).getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }

    act(() => notify([{ target: niveles, isIntersecting: true }]));
    expect(within(bar()).getByRole("link", { name: "Niveles" })).toHaveAttribute("aria-current", "location");

    act(() =>
      notify([
        { target: niveles, isIntersecting: false },
        { target: preguntas, isIntersecting: true },
      ]),
    );
    expect(within(bar()).getByRole("link", { name: "Preguntas" })).toHaveAttribute("aria-current", "location");
    expect(within(bar()).getByRole("link", { name: "Niveles" })).not.toHaveAttribute("aria-current");
  });

  it("brings the marked link into a narrow row, and the row back to its start at the hero", () => {
    document.body.innerHTML = '<section id="niveles"></section>';
    const niveles = document.getElementById("niveles")!;
    render(<SellerSectionNav promoActive />, { container: document.body.appendChild(document.createElement("div")) });

    // jsdom lays nothing out: give the row an overflow and the link a place.
    const row = within(bar()).getByRole("list");
    Object.defineProperties(row, { clientWidth: { value: 300 }, scrollWidth: { value: 800 } });
    const link = within(bar()).getByRole("link", { name: "Niveles" });
    Object.defineProperties(link, { offsetLeft: { value: 600 }, offsetWidth: { value: 100 } });
    const scrollTo = vi.fn();
    row.scrollTo = scrollTo;

    act(() => notify([{ target: niveles, isIntersecting: true }]));
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: "smooth", left: 500 });

    act(() => notify([{ target: niveles, isIntersecting: false }]));
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: "smooth", left: 0 });
  });
});
