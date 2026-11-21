import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BenefitsBento } from "@/components/home/landing/benefits-bento";
import { LandingArticle } from "@/components/home/landing/landing-article";
import { SellerStepsShowcase } from "@/components/home/landing/seller-steps-showcase";
import type { PostMeta } from "@/lib/posts";

const season = { on: true };

vi.mock("@/lib/navidad", () => ({
  get NAVIDAD_ACTIVA() {
    return season.on;
  },
}));

afterEach(() => {
  cleanup();
  season.on = true;
});

const POSTS: PostMeta[] = [
  { slug: "tienda-propia", title: "Tu tienda propia", description: "Por qué conviene.", date: "2026-11-10", draft: false },
  { slug: "cuanto-te-queda", title: "Cuánto te queda", description: "Las cuentas.", date: "2026-10-20", draft: false },
];

/** The three middle sections of the landing, in page order. */
function renderSections({ promoActive = true } = {}) {
  render(
    <>
      <BenefitsBento promoActive={promoActive} />
      <SellerStepsShowcase />
      <LandingArticle posts={POSTS} />
    </>,
  );
}

const rules = () => screen.getByRole("region", { name: "Lo que vendes, es tuyo." });
const steps = () => screen.getByRole("region", { name: "Tres pasos y ya vendes." });
const blog = () => screen.getByRole("region", { name: "Del blog" });

function overlaysOf(anchor: Element) {
  return [...anchor.children].filter((child) => child.classList.contains("nv"));
}

function pictureOf(overlay: Element) {
  return overlay.querySelector("img")?.getAttribute("src");
}

const POSITIONED = /(^|\s)(?:[a-z0-9-]+:)*(?:sticky|absolute|fixed|relative)(\s|$)/;

describe("the Christmas layer on 'Tus reglas', 'Abre tu tienda' and 'Del blog'", () => {
  it("snows inside the founders block and hangs holly on its 0%", () => {
    renderSections();

    const block = screen.getByText("TIENDAS FUNDADORAS").parentElement as HTMLElement;
    // Already relative and clipping, so it holds the flakes without an anchor.
    expect(block).toHaveClass("relative", "overflow-hidden");
    expect(block).not.toHaveClass("nv-anclaje");
    const flakes = overlaysOf(block);
    expect(flakes.map((piece) => [piece.className, pictureOf(piece)])).toEqual([["nv nv--copos", "/navidad/copo-lima.svg"]]);
    expect(block.lastElementChild).toBe(flakes[0]);

    const zero = screen.getByText("0%");
    expect(zero.tagName).toBe("SPAN");
    expect(zero).toHaveClass("nv-anclaje");
    expect(zero.lastElementChild).toHaveClass("nv", "nv--acebo");
    expect(zero.lastElementChild?.tagName).toBe("SPAN");
    expect(pictureOf(zero.lastElementChild!)).toBe("/navidad/acebo.svg");
    // The heading still reads exactly as before.
    expect(screen.getByRole("heading", { level: 3, name: /^0% de comisión fija 12 meses\.$/ })).toBeInTheDocument();
  });

  it("puts a poinsettia on the top-right benefit, from tablets up", () => {
    renderSections();

    const tile = screen.getByRole("heading", { name: "Tu reputación viene contigo" }).closest("article") as HTMLElement;
    expect(tile).toHaveClass("nv-anclaje");
    expect(tile.lastElementChild).toHaveClass("nv", "nv--flor", "nv--solo-desktop");
    expect(pictureOf(tile.lastElementChild!)).toBe("/navidad/nochebuena.svg");
    expect(rules().querySelectorAll(".nv--flor")).toHaveLength(1);
  });

  it("keeps the poinsettia once the founders block is gone", () => {
    renderSections({ promoActive: false });

    expect(screen.queryByText("TIENDAS FUNDADORAS")).toBeNull();
    expect(rules().querySelectorAll(".nv")).toHaveLength(1);
    expect(rules().querySelector(".nv")).toHaveClass("nv--flor");
  });

  it("ties a bow on both 'Crear mi tienda gratis' buttons and snows over the steps", () => {
    renderSections();

    const buttons = screen.getAllByRole("link", { name: "Crear mi tienda gratis" });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toHaveClass("nv-anclaje", "bg-brand");
      const bow = button.lastElementChild as HTMLElement;
      expect(bow).toHaveClass("nv", "nv--mono");
      expect(bow.tagName).toBe("SPAN");
    }

    expect(steps()).toHaveClass("nv-anclaje");
    const pieces = overlaysOf(steps());
    expect(pieces.map((piece) => [piece.className, pictureOf(piece)])).toEqual([["nv nv--copos", "/navidad/copo-pino.svg"]]);
    expect(steps().lastElementChild).toBe(pieces[0]);
  });

  it("dresses the blog card with flakes and, from tablets up, a poinsettia", () => {
    renderSections();

    const card = blog().firstElementChild as HTMLElement;
    expect(card).toHaveClass("bg-lime-tint", "nv-anclaje");
    expect(overlaysOf(card).map((piece) => [piece.className, pictureOf(piece)])).toEqual([
      ["nv nv--flor nv--solo-desktop", "/navidad/nochebuena.svg"],
      ["nv nv--copos", "/navidad/copo-pino.svg"],
    ]);
    expect(card.lastElementChild).toHaveClass("nv--copos");
    // The section around the card stays as it was.
    expect(blog()).not.toHaveClass("nv-anclaje");
    expect(overlaysOf(blog())).toEqual([]);
  });

  it("keeps every flake faint and well inside its field", () => {
    renderSections();

    const fields = document.querySelectorAll(".nv--copos");
    expect(fields).toHaveLength(3);
    for (const field of fields) {
      const flakes = field.querySelectorAll("img");
      expect(flakes.length).toBeGreaterThanOrEqual(3);
      expect(flakes.length).toBeLessThanOrEqual(5);
      for (const flake of flakes) {
        const opacity = Number(flake.style.opacity);
        expect(opacity).toBeGreaterThanOrEqual(0.13);
        expect(opacity).toBeLessThanOrEqual(0.22);
        // A 24px flake past ~90% of a 320px-wide field would spill out of it.
        expect(parseFloat(flake.style.left)).toBeLessThanOrEqual(88);
        expect(parseFloat(flake.style.top)).toBeLessThanOrEqual(88);
      }
    }
  });

  it("hides every piece from assistive technology, loads it lazily and gives no picture a name", () => {
    renderSections();

    const overlays = document.querySelectorAll(".nv");
    expect(overlays.length).toBe(8);
    for (const overlay of overlays) {
      expect(overlay).toHaveAttribute("aria-hidden", "true");
      for (const img of overlay.querySelectorAll("img")) {
        expect(img).toHaveAttribute("alt", "");
        expect(img).toHaveAttribute("loading", "lazy");
      }
    }
  });

  it("anchors only elements that were not positioned already", () => {
    renderSections();

    const anchors = document.querySelectorAll(".nv-anclaje");
    expect(anchors).toHaveLength(6);
    for (const anchor of anchors) {
      expect(anchor.getAttribute("class")).not.toMatch(POSITIONED);
    }
  });

  it("leaves the sections byte for byte as they were once the season is off", () => {
    season.on = false;
    renderSections();
    const off = document.body.innerHTML;
    cleanup();

    season.on = true;
    renderSections();
    for (const overlay of document.querySelectorAll(".nv")) overlay.remove();
    // The anchor class is always appended last, after a space.
    for (const anchor of document.querySelectorAll(".nv-anclaje")) {
      anchor.setAttribute("class", anchor.getAttribute("class")!.replace(/ nv-anclaje$/, ""));
    }

    expect(off).not.toMatch(/\bnv\b|nv-|\/navidad\//);
    expect(document.body.innerHTML).toBe(off);
  });
});
