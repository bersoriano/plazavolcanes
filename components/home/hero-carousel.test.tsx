import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeroCarousel } from "@/components/home/hero-carousel";

afterEach(cleanup);

function currentSlide() {
  const slide = screen.getByRole("heading", { level: 1 }).closest("[aria-roledescription='diapositiva']");
  if (!slide) throw new Error("the active heading is not inside a slide");
  return slide;
}

function currentHeading() {
  return screen.getByRole("heading", { level: 1 }).textContent;
}

describe("HeroCarousel", () => {
  it("opens on the welcome slide and exposes only that one", () => {
    render(<HeroCarousel />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(currentHeading()).toContain("Bienvenido");
    expect(currentSlide().querySelector('img[src*="hero2.jpg"]')).toBeInTheDocument();
  });

  it("fits each photograph whole instead of cropping the subject", () => {
    render(<HeroCarousel />);

    const photos = document.querySelectorAll("[aria-roledescription='diapositiva'] img");

    expect(photos).toHaveLength(2);
    photos.forEach((photo) => {
      expect(photo).toHaveClass("object-contain");
      expect(photo).not.toHaveClass("object-cover");
    });
  });

  it("keeps the inactive slides out of the tab order", () => {
    render(<HeroCarousel />);

    const slides = document.querySelectorAll("[aria-roledescription='diapositiva']");

    expect(slides).toHaveLength(3);
    expect(slides[0]).not.toHaveAttribute("inert");
    expect(slides[1]).toHaveAttribute("inert");
    expect(slides[2]).toHaveAttribute("inert");
  });

  it("advances to the next slide when the right arrow is clicked", () => {
    render(<HeroCarousel />);

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(currentHeading()).toContain("Encuentra productos únicos cerca de ti");
  });

  it("wraps from the last slide back to the first", () => {
    render(<HeroCarousel />);
    const next = screen.getByRole("button", { name: "Siguiente" });

    fireEvent.click(next);
    fireEvent.click(next);
    expect(currentHeading()).toContain("reputación");

    fireEvent.click(next);
    expect(currentHeading()).toContain("Bienvenido");
  });

  it("wraps backwards from the first slide to the last", () => {
    render(<HeroCarousel />);

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));

    expect(currentHeading()).toContain("reputación");
  });

  it("jumps straight to a slide from its dot and marks it current", () => {
    render(<HeroCarousel />);

    const dot = screen.getByRole("button", { name: "Ir a la diapositiva 3" });
    fireEvent.click(dot);

    expect(currentHeading()).toContain("reputación");
    expect(dot).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Ir a la diapositiva 1" })).not.toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("navigates with the arrow keys", () => {
    render(<HeroCarousel />);
    const region = screen.getByRole("region", { name: /plaza volcanes/i });

    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(currentHeading()).toContain("Encuentra productos únicos cerca de ti");

    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(currentHeading()).toContain("Bienvenido");
  });

  it("never advances on its own", () => {
    vi.useFakeTimers();
    try {
      render(<HeroCarousel />);

      vi.advanceTimersByTime(60_000);

      expect(currentHeading()).toContain("Bienvenido");
    } finally {
      vi.useRealTimers();
    }
  });
});
