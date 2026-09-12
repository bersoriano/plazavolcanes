import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CatalogToolbar } from "@/components/products/catalog-toolbar";
import type { CatalogCounts } from "@/lib/seller-catalog";

afterEach(cleanup);

function counts(overrides: Partial<CatalogCounts> = {}): CatalogCounts {
  return { todos: 12, publicados: 7, borradores: 3, vencidos: 2, bloqueados: 0, ...overrides };
}

function renderToolbar(props: Partial<Parameters<typeof CatalogToolbar>[0]> = {}) {
  return render(
    <CatalogToolbar shopId={4} tab="todos" search="" counts={counts()} {...props} />,
  );
}

describe("catalogue tabs", () => {
  it("puts the count of each bucket on its tab", () => {
    renderToolbar();

    expect(screen.getByRole("link", { name: "Todos 12" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Publicados 7" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Borradores 3" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vencidos 2" })).toBeInTheDocument();
  });

  it("hides the blocked tab while administration has blocked nothing", () => {
    // Most sellers never see an admin block. A permanent "Bloqueados 0" would
    // put a problem on screen that nobody has.
    renderToolbar();

    expect(screen.queryByRole("link", { name: /Bloqueados/ })).not.toBeInTheDocument();
  });

  it("shows the blocked tab as soon as something is blocked", () => {
    renderToolbar({ counts: counts({ bloqueados: 1 }) });

    expect(screen.getByRole("link", { name: "Bloqueados 1" })).toBeInTheDocument();
  });

  it("marks the open tab for assistive technology", () => {
    renderToolbar({ tab: "vencidos" });

    expect(screen.getByRole("link", { name: "Vencidos 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Todos 12" })).not.toHaveAttribute("aria-current");
  });

  it("carries the search term from one tab to the next", () => {
    // Switching tabs while searching should narrow the same search, not throw
    // the seller back to an unfiltered list.
    renderToolbar({ tab: "todos", search: "taza" });

    expect(screen.getByRole("link", { name: "Publicados 7" })).toHaveAttribute(
      "href",
      "/panel/tiendas/4?estado=publicados&buscar=taza",
    );
  });

  it("drops the filter from the URL on the tab that holds everything", () => {
    renderToolbar({ tab: "borradores" });

    expect(screen.getByRole("link", { name: "Todos 12" })).toHaveAttribute(
      "href",
      "/panel/tiendas/4",
    );
  });
});

describe("catalogue search", () => {
  it("submits as a plain GET so a filtered catalogue survives a refresh", () => {
    renderToolbar();

    const form = screen.getByRole("search");

    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/panel/tiendas/4");
  });

  it("keeps the open tab when a search is submitted", () => {
    const { container } = renderToolbar({ tab: "vencidos" });

    const hidden = container.querySelector('input[type="hidden"][name="estado"]');

    expect(hidden).toHaveValue("vencidos");
  });

  it("sends no tab from the tab that holds everything", () => {
    const { container } = renderToolbar({ tab: "todos" });

    expect(container.querySelector('input[name="estado"]')).toBeNull();
  });

  it("shows the seller what they last searched for", () => {
    renderToolbar({ search: "taza" });

    expect(screen.getByRole("searchbox", { name: /buscar/i })).toHaveValue("taza");
  });
});

describe("adding a product", () => {
  it("points at the shop's own new product form", () => {
    renderToolbar();

    expect(screen.getByRole("link", { name: /Agregar producto/ })).toHaveAttribute(
      "href",
      "/panel/tiendas/4/productos/nuevo",
    );
  });

  it("stays reachable while the catalogue is filtered down to nothing", () => {
    // The toolbar is the only way back out of an empty filtered view, so it
    // renders whole even when no row survives the filter.
    renderToolbar({ tab: "vencidos", search: "nada", counts: counts({ vencidos: 0 }) });

    const toolbar = screen.getByRole("navigation", { name: "Estado de las publicaciones" });

    expect(within(toolbar).getByRole("link", { name: "Todos 12" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Agregar producto/ })).toBeInTheDocument();
  });
});
