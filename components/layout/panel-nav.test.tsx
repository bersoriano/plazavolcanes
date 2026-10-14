import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PanelNav } from "@/components/layout/panel-nav";

const route = { pathname: "/panel" };

vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

  describe("on a screen narrower than the row", () => {
    /**
     * jsdom lays nothing out, so the boxes are given: a 320px screen, and the
     * open area's link wherever the test puts it.
     */
    function layOut(open: { left: number; right: number }) {
      const scrollTo = vi.fn();
      Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
        const box = this.matches('[aria-current="page"]') ? open : { left: 0, right: 320 };
        return { ...box, width: box.right - box.left } as DOMRect;
      });
      return scrollTo;
    }

    it("brings the open area into view when it starts out past the edge", () => {
      // The last area's mark was cut off by the edge of a 320px phone: the one
      // place the bar could not say where the reader was.
      const scrollTo = layOut({ left: 260, right: 333 });

      renderAt("/panel/cuenta");

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo.mock.calls[0][0].left).toBeGreaterThan(0);
    });

    it("leaves the row where it is when the open area already shows", () => {
      const scrollTo = layOut({ left: 98, right: 175 });

      renderAt("/panel/pedidos");

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  it("names every area for a thumb", () => {
    const bar = renderAt("/panel");

    for (const name of SECTIONS) {
      expect(bar.getByRole("link", { name })).toHaveClass("tap");
    }
  });
});
