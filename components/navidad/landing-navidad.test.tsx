import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinalCta } from "@/components/home/landing/final-cta";
import { PrimaryCta } from "@/components/home/landing/primitives";
import { SellerHero } from "@/components/home/landing/seller-hero";
import { LaunchBarFrame } from "@/components/layout/launch-bar-frame";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

const season = { on: true };
const route = { pathname: "/" };
const auth = { signedIn: false };

vi.mock("@/lib/navidad", () => ({
  get NAVIDAD_ACTIVA() {
    return season.on;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/admin-auth.server", () => ({
  getCurrentUserAdminStatus: vi.fn(async () => ({ isAdmin: false, signedIn: auth.signedIn })),
}));
vi.mock("@/lib/queries/messages.server", () => ({ fetchUnreadCount: vi.fn(async () => 0) }));

afterEach(() => {
  cleanup();
  season.on = true;
  route.pathname = "/";
  auth.signedIn = false;
});

/** The landing's decorated surfaces, top to bottom. */
async function renderLanding() {
  render(
    <>
      <LaunchBarFrame cap={100} dismissAction={async () => {}} spotsLeft={90} />
      {await SiteHeader()}
      <SellerHero latest={null} promoActive spotsTaken={10} />
      <FinalCta />
      <SiteFooter />
    </>,
  );
}

const hero = () => screen.getByRole("region", { name: "Tu tienda, tus reglas." });
const finalCta = () => screen.getByRole("region", { name: "Tus reglas, desde el primer día." });
const header = () => document.querySelector("[data-site-header]") as HTMLElement;
const footer = () => document.querySelector("[data-site-footer]") as HTMLElement;
const launchBar = () => document.querySelector("[data-launch-bar]") as HTMLElement;

/** The overlays appended straight into an anchor, in order. */
function overlaysOf(anchor: Element) {
  return [...anchor.children].filter((child) => child.classList.contains("nv"));
}

function pictureOf(overlay: Element) {
  return overlay.querySelector("img")?.getAttribute("src");
}

const POSITIONED = /(^|\s)(?:[a-z0-9-]+:)*(?:sticky|absolute|fixed|relative)(\s|$)/;

describe("the Christmas layer on the landing", () => {
  it("puts the hat on the header's logo mark and leaves the header itself bare", async () => {
    await renderLanding();

    // No garland (brief row 01): on the sticky header it rode over the page.
    expect(overlaysOf(header())).toEqual([]);

    const logo = screen.getByRole("link", { name: "Plaza Volcanes, inicio" });
    const wrapper = logo.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("nv-anclaje");
    expect(wrapper.firstElementChild).toHaveClass("overflow-hidden", "bg-brand");
    expect(wrapper.lastElementChild).toHaveClass("nv", "nv--gorro");
  });

  it("dresses the hero: poinsettia, flakes, snow cap, holly and posada star", async () => {
    await renderLanding();

    const card = screen.getByText("Tiendas fundadoras").closest("div") as HTMLElement;
    expect(card).toHaveClass("nv-anclaje");
    expect(card.lastElementChild).toHaveClass("nv", "nv--flor");
    expect(pictureOf(card.lastElementChild!)).toBe("/navidad/nochebuena.svg");

    // No ornaments or seal (brief rows 04 and 13): they sat on the copy.
    const pieces = overlaysOf(hero());
    expect(pieces.map((piece) => [piece.className, pictureOf(piece) ?? null])).toEqual([
      ["nv nv--copos", "/navidad/copo-pino.svg"],
    ]);
    expect(hero().lastElementChild).toBe(pieces.at(-1));

    const highlight = screen.getByText("tus reglas.");
    expect(highlight.tagName).toBe("EM");
    expect(highlight).toHaveClass("inline-block", "nv-anclaje");
    expect(highlight.lastElementChild).toHaveClass("nv", "nv--nieve");
    expect(highlight.lastElementChild?.tagName).toBe("SPAN");

    const badge = screen.getByText("comisión").parentElement as HTMLElement;
    expect(badge.lastElementChild).toHaveClass("nv", "nv--acebo");

    const rules = screen.getByText("Reglas de mi tienda").closest(".shadow-float") as HTMLElement;
    expect(rules.lastElementChild).toHaveClass("nv", "nv--posada");
  });

  it("opens the hero with the season's legend, beside the audience pill", async () => {
    await renderLanding();

    const legend = within(hero()).getByText("¡Prepárate para Navidad!");
    expect(legend.tagName).toBe("P");
    expect(legend).not.toHaveAttribute("aria-hidden");
    expect(legend.nextElementSibling).toHaveTextContent("Para tiendas independientes de México");
    expect(legend.parentElement).toHaveClass("flex", "flex-wrap");
  });

  it("ties a bow on both 'Abrir mi tienda gratis' buttons, hung from the link itself", async () => {
    await renderLanding();

    const buttons = screen.getAllByRole("link", { name: "Abrir mi tienda gratis" });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toHaveClass("nv-anclaje", "bg-brand", "shadow-cta");
      expect(button.parentElement?.tagName).toBe("DIV");
      const bow = button.querySelector(".nv--mono") as HTMLElement;
      expect(bow).toHaveClass("nv");
      expect(bow.tagName).toBe("SPAN");
    }
    // The hero's is above the fold; the closing band's is not.
    expect(within(hero()).getByRole("link", { name: "Abrir mi tienda gratis" }).querySelector("img")).not.toHaveAttribute("loading");
    expect(within(finalCta()).getByRole("link", { name: "Abrir mi tienda gratis" }).querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  it("lights the closing band and lays a pine branch in its corner on desktop", async () => {
    await renderLanding();

    expect(overlaysOf(finalCta()).map((piece) => piece.className)).toEqual([
      "nv nv--rama nv--solo-desktop",
      "nv nv--luces",
      "nv nv--copos",
    ]);
  });

  it("snows over the plum bars, without the footer's short snow edge", async () => {
    await renderLanding();

    // No snow edge (brief row 11): nieve.svg stops at 86% of its width.
    const pieces = overlaysOf(footer());
    expect(pieces.map((piece) => [piece.className, pictureOf(piece)])).toEqual([
      ["nv nv--copos", "/navidad/copo-lima.svg"],
    ]);

    expect(launchBar()).toHaveClass("nv-anclaje");
    const barFlakes = overlaysOf(launchBar());
    expect(barFlakes).toHaveLength(1);
    expect(pictureOf(barFlakes[0])).toBe("/navidad/copo-lima.svg");
  });

  it("keeps every flake faint, and the bar's inside the viewport", async () => {
    await renderLanding();

    const fields = document.querySelectorAll(".nv--copos");
    expect(fields).toHaveLength(4);
    for (const field of fields) {
      const flakes = field.querySelectorAll("img");
      expect(flakes.length).toBeGreaterThanOrEqual(3);
      expect(flakes.length).toBeLessThanOrEqual(5);
      for (const flake of flakes) {
        const opacity = Number(flake.style.opacity);
        expect(opacity).toBeGreaterThanOrEqual(0.13);
        expect(opacity).toBeLessThanOrEqual(0.22);
      }
    }

    // The bar does not clip its overflow: a 24px flake past ~92% of a 320px
    // phone would widen the page.
    for (const flake of launchBar().querySelectorAll(".nv--copos img")) {
      expect(parseFloat((flake as HTMLElement).style.left)).toBeLessThanOrEqual(90);
    }
  });

  it("hides every piece from assistive technology and gives no picture a name", async () => {
    await renderLanding();

    const overlays = document.querySelectorAll(".nv");
    expect(overlays.length).toBeGreaterThan(10);
    for (const overlay of overlays) {
      expect(overlay).toHaveAttribute("aria-hidden", "true");
      for (const img of overlay.querySelectorAll("img")) {
        expect(img).toHaveAttribute("alt", "");
      }
    }
    expect(document.querySelector(".nv-liston")).toBeNull();
  });

  it("anchors only elements that were not positioned already", async () => {
    await renderLanding();

    const anchors = document.querySelectorAll(".nv-anclaje");
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor.getAttribute("class")).not.toMatch(POSITIONED);
    }
  });

  it("loads the pieces below the fold lazily", async () => {
    await renderLanding();

    for (const img of finalCta().querySelectorAll(".nv img")) {
      expect(img).toHaveAttribute("loading", "lazy");
    }
    for (const img of footer().querySelectorAll(".nv img")) {
      expect(img).toHaveAttribute("loading", "lazy");
    }
    for (const img of [...header().querySelectorAll(".nv img"), ...hero().querySelectorAll(".nv img")]) {
      expect(img).not.toHaveAttribute("loading");
    }
  });

  it("decorates the signed-in header's logo too", async () => {
    auth.signedIn = true;
    await renderLanding();

    const logo = screen.getByRole("link", { name: "Plaza Volcanes, inicio" });
    expect(logo.firstElementChild?.lastElementChild).toHaveClass("nv", "nv--gorro");
  });

  it("keeps the shared header, footer and bar plain away from the landing", async () => {
    route.pathname = "/explorar";
    render(
      <>
        <LaunchBarFrame cap={100} dismissAction={async () => {}} spotsLeft={90} />
        {await SiteHeader()}
        <SiteFooter />
      </>,
    );

    expect(document.querySelector(".nv, .nv-anclaje")).toBeNull();
  });

  it("leaves no trace once the season is switched off", async () => {
    season.on = false;
    await renderLanding();

    const classed = [...document.querySelectorAll("[class]")].filter((element) =>
      element.getAttribute("class")!.split(/\s+/).some((name) => name.startsWith("nv")),
    );
    expect(classed).toEqual([]);
    expect(document.querySelectorAll("img[src^='/navidad/']")).toHaveLength(0);
    expect(screen.queryByText(/Navidad/)).toBeNull();
    // The audience pill is back as the column's first child, unwrapped.
    expect(screen.getByText("Para tiendas independientes de México").parentElement).toHaveClass("items-start", "flex-col");

    // Byte for byte the button the landing had before the layer.
    const plain = render(
      <PrimaryCta block href="/registro?vender=1">
        Abrir mi tienda gratis
      </PrimaryCta>,
    ).container.innerHTML;
    for (const button of screen.getAllByRole("link", { name: "Abrir mi tienda gratis" })) {
      expect(button.parentElement?.tagName).toBe("DIV");
      expect(button.outerHTML).toBe(plain);
    }
    const logo = screen.getByRole("link", { name: "Plaza Volcanes, inicio" });
    expect(logo.firstElementChild).toHaveClass("overflow-hidden", "bg-brand");
  });
});
