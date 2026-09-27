import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StickyCta } from "@/components/sellers/sticky-cta";
import { SellerProgram } from "@/components/sellers/seller-program";

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
});

function page() {
  document.body.innerHTML = '<a data-hero-cta></a><section data-final-cta></section>';
  return {
    hero: document.querySelector("[data-hero-cta]")!,
    final: document.querySelector("[data-final-cta]")!,
  };
}

function bar() {
  return document.querySelector<HTMLElement>("[data-sticky-cta]")!;
}

describe("StickyCta", () => {
  it("waits for the hero CTA to scroll away, then steps aside at the closing call", () => {
    const { hero, final } = page();
    render(<StickyCta href="/registro?vender=1&desde=sticky" spotsTaken={38} />, {
      container: document.body.appendChild(document.createElement("div")),
    });

    expect(bar()).toHaveAttribute("hidden");

    act(() => notify([{ target: hero, isIntersecting: false, boundingClientRect: { top: -40 } as DOMRect }]));
    expect(bar()).not.toHaveAttribute("hidden");
    expect(screen.getByText(/Quedan/)).toHaveTextContent("Quedan 62 lugares");
    expect(screen.getByRole("link", { name: "Crear mi tienda" })).toHaveAttribute("href", "/registro?vender=1&desde=sticky");

    act(() => notify([{ target: final, isIntersecting: true, boundingClientRect: { top: 300 } as DOMRect }]));
    expect(bar()).toHaveAttribute("hidden");

    // Past the closing call (over the footer) it stays away.
    act(() => notify([{ target: final, isIntersecting: false, boundingClientRect: { top: -900 } as DOMRect }]));
    expect(bar()).toHaveAttribute("hidden");
  });

  it("names the offer when there is no count", () => {
    page();
    render(<StickyCta href="/registro?vender=1&desde=sticky" spotsTaken={null} />);

    expect(screen.getByText("Primeras 100 tiendas")).toBeInTheDocument();
  });
});

describe("SellerProgram and the sticky bar", () => {
  const open = { open: true, taken: null, cap: 100 };

  it("is offered to a visitor and to somebody without a store", () => {
    render(<SellerProgram founders={open} viewer="no-shop" />);
    expect(bar()).not.toBeNull();
    expect(screen.getByRole("link", { name: "Crear mi tienda", hidden: true })).toHaveAttribute(
      "href",
      "/panel/tiendas/nueva?desde=sticky",
    );
  });

  it("is left out for an owner and once the promotion has ended", () => {
    render(<SellerProgram founders={open} viewer="owner" />);
    expect(document.querySelector("[data-sticky-cta]")).toBeNull();
    cleanup();

    render(<SellerProgram founders={{ open: false, taken: 100, cap: 100 }} />);
    expect(document.querySelector("[data-sticky-cta]")).toBeNull();
  });
});
