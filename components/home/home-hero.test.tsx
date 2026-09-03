import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeHero } from "@/components/home/home-hero";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  // @ts-expect-error jsdom ships no matchMedia; the tests add one when they need it.
  delete window.matchMedia;
});

/** jsdom has no matchMedia, so a test that cares about motion brings its own. */
function stubMotionPreference(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

function currentHeading() {
  return screen.getByRole("heading", { level: 1 }).textContent;
}

describe("HomeHero", () => {
  it("opens on the first message with its kicker, headline and deck", () => {
    render(<HomeHero />);

    expect(screen.getByText("Hecho cerca. Encontrado aquí.")).toBeInTheDocument();
    expect(currentHeading()).toBe("Encuentra productos únicos cerca de ti.");
    expect(
      screen.getByText(/Explora artículos nuevos y usados, revisa quién vende/),
    ).toBeInTheDocument();
  });

  it("colours only the closing phrase of the headline", () => {
    render(<HomeHero />);

    const emphasis = screen.getByRole("heading", { level: 1 }).querySelector("em");

    expect(emphasis).toHaveTextContent("cerca de ti.");
    expect(emphasis).toHaveClass("italic", "text-brand");
  });

  it("carries the eyebrow pill and both calls to action", () => {
    render(<HomeHero />);

    expect(screen.getByText("Gratis para las primeras tiendas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar productos" })).toHaveAttribute(
      "href",
      "#catalogo",
    );
    expect(screen.getByRole("link", { name: "Abrir mi tienda" })).toHaveAttribute(
      "href",
      "/registro",
    );
  });

  it("rotates to the next message every seven seconds and wraps around", () => {
    vi.useFakeTimers();
    render(<HomeHero />);

    act(() => void vi.advanceTimersByTime(7_000));
    expect(currentHeading()).toBe("Crea tu tienda y sube lo que quieras vender.");

    act(() => void vi.advanceTimersByTime(7_000));
    expect(currentHeading()).toBe("Construye tu reputación y vende a todo México.");

    act(() => void vi.advanceTimersByTime(7_000));
    expect(currentHeading()).toBe("Encuentra productos únicos cerca de ti.");
  });

  it("holds still short of the interval", () => {
    vi.useFakeTimers();
    render(<HomeHero />);

    act(() => void vi.advanceTimersByTime(6_999));

    expect(currentHeading()).toBe("Encuentra productos únicos cerca de ti.");
  });

  it("never rotates for a reader who asked for less motion", () => {
    stubMotionPreference(true);
    vi.useFakeTimers();
    render(<HomeHero />);

    act(() => void vi.advanceTimersByTime(60_000));

    expect(currentHeading()).toBe("Encuentra productos únicos cerca de ti.");
  });

  it("still rotates when no motion preference is expressed", () => {
    stubMotionPreference(false);
    vi.useFakeTimers();
    render(<HomeHero />);

    act(() => void vi.advanceTimersByTime(7_000));

    expect(currentHeading()).toBe("Crea tu tienda y sube lo que quieras vender.");
  });

  it("jumps to a message from its dot and marks that dot current", () => {
    render(<HomeHero />);

    const third = screen.getByRole("button", { name: "Ver mensaje 3" });
    fireEvent.click(third);

    expect(currentHeading()).toBe("Construye tu reputación y vende a todo México.");
    expect(third).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Ver mensaje 1" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("widens the active dot and keeps a 44px hit area on every one", () => {
    render(<HomeHero />);

    const dots = [1, 2, 3].map((position) =>
      screen.getByRole("button", { name: `Ver mensaje ${position}` }),
    );

    dots.forEach((dot) => expect(dot).toHaveClass("tap-halo", "h-[9px]"));
    expect(dots[0]).toHaveClass("w-[30px]", "bg-brand");
    expect(dots[1]).toHaveClass("w-[9px]", "bg-line");
  });

  it("reserves three collage slots and hides them from assistive tech", () => {
    const { container } = render(<HomeHero />);

    const collage = container.querySelector('[aria-hidden="true"].grid');
    expect(collage).not.toBeNull();
    expect(collage!.children).toHaveLength(3);
    expect(collage!.children[0]).toHaveClass("col-span-2", "aspect-[16/10]");
    expect(collage!.children[1]).toHaveClass("aspect-square");
    expect(collage!.children[2]).toHaveClass("aspect-square");
  });

  it("collapses to one column without a media query", () => {
    const { container } = render(<HomeHero />);

    const grid = container.querySelector(
      ".\\[grid-template-columns\\:repeat\\(auto-fit\\,minmax\\(min\\(100\\%\\,400px\\)\\,1fr\\)\\)\\]",
    );

    expect(grid).not.toBeNull();
  });
});
