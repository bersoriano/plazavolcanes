import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import { LEGAL_ROUTES } from "@/lib/legal/document-types";

afterEach(cleanup);

describe("SiteFooter", () => {
  it("keeps every navigation destination at least 44px tall", () => {
    render(<SiteFooter />);

    const footer = screen.getByRole("contentinfo");
    const links = within(footer).getAllByRole("link");

    expect(links).not.toHaveLength(0);
    for (const link of links) {
      expect(link).toHaveClass("inline-flex", "min-h-11", "items-center");
    }
  });

  it("exposes every legal route", () => {
    render(<SiteFooter />);

    const legal = screen.getByRole("navigation", { name: "Información legal" });

    for (const route of LEGAL_ROUTES) {
      expect(within(legal).getByRole("link", { name: route.navLabel })).toHaveAttribute(
        "href",
        route.path,
      );
    }
  });

  it("keeps the existing browse links", () => {
    render(<SiteFooter />);

    const nav = screen.getByRole("navigation", { name: "Navegación" });

    expect(within(nav).getByRole("link", { name: "Explorar" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Crear tienda" })).toHaveAttribute("href", "/registro");
    expect(within(nav).getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/ingresar");
  });

  it("keeps the print stylesheet marker", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("contentinfo")).toHaveAttribute("data-site-footer");
  });
});
