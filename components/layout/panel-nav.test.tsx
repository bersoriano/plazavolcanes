import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PanelNav } from "@/components/layout/panel-nav";

const route = { pathname: "/panel" };

vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

afterEach(cleanup);

const SECTIONS = ["Resumen", "Pedidos", "Tiendas", "Cuenta"] as const;

function renderAt(pathname: string) {
  route.pathname = pathname;
  render(<PanelNav />);
  return within(screen.getByRole("navigation", { name: "Secciones del panel" }));
}

/** The one section marked as open, by its label. */
function marked(bar: ReturnType<typeof renderAt>) {
  return bar
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);
}

describe("PanelNav", () => {
  it("links the panel's four areas, in order", () => {
    const bar = renderAt("/panel");

    expect(bar.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Resumen", "/panel"],
      ["Pedidos", "/panel/pedidos"],
      ["Tiendas", "/panel/tiendas"],
      ["Cuenta", "/panel/cuenta"],
    ]);
  });

  it("leaves messages to the site's own navigation", () => {
    const bar = renderAt("/panel");

    expect(bar.queryByRole("link", { name: /Mensajes/ })).toBeNull();
  });

  it.each([
    ["/panel", "Resumen"],
    ["/panel/pedidos", "Pedidos"],
    ["/panel/pedidos/41", "Pedidos"],
    ["/panel/tiendas", "Tiendas"],
    ["/panel/tiendas/nueva", "Tiendas"],
    ["/panel/tiendas/4", "Tiendas"],
    ["/panel/tiendas/4/ajustes", "Tiendas"],
    ["/panel/tiendas/4/productos/nuevo", "Tiendas"],
    ["/panel/cuenta", "Cuenta"],
  ])("marks the area %s belongs to", (pathname, section) => {
    expect(marked(renderAt(pathname))).toEqual([section]);
  });

  it("keeps the summary from claiming every route below it", () => {
    // Every panel route starts with /panel; a prefix match would light the
    // summary up everywhere, next to the area actually open.
    const bar = renderAt("/panel/pedidos");

    expect(bar.getByRole("link", { name: "Resumen" })).not.toHaveAttribute("aria-current");
  });

  it("counts a product's editor as part of its shop", () => {
    // The editor's URL sits outside /panel/tiendas, but it is reached from a
    // shop's catalogue and goes back to it.
    expect(marked(renderAt("/panel/productos/9/editar"))).toEqual(["Tiendas"]);
  });

  it("marks nothing outside the panel", () => {
    expect(marked(renderAt("/mensajes"))).toEqual([]);
  });

  it("names every area for a thumb", () => {
    const bar = renderAt("/panel");

    for (const name of SECTIONS) {
      expect(bar.getByRole("link", { name })).toHaveClass("tap");
    }
  });
});
