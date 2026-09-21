import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BottomNavLinks, type BottomNavItem } from "@/components/layout/bottom-nav-links";

const route = { pathname: "/" };

vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

afterEach(cleanup);

const ITEMS: BottomNavItem[] = [
  { href: "/", icon: "explore", label: "Explorar" },
  { href: "/vender?desde=nav", icon: "sell", label: "Vender" },
  { href: "/ingresar", icon: "account", label: "Ingresar" },
];

function renderAt(pathname: string) {
  route.pathname = pathname;
  render(<BottomNavLinks items={ITEMS} />);
}

describe("BottomNavLinks", () => {
  it("marks an entry current even when its link carries a source", () => {
    renderAt("/vender");

    expect(screen.getByRole("link", { name: "Vender" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Explorar" })).not.toHaveAttribute("aria-current");
  });

  it("marks the entry current on a route nested under it", () => {
    renderAt("/vender/algo");

    expect(screen.getByRole("link", { name: "Vender" })).toHaveAttribute("aria-current", "page");
  });

  it("leaves the entry alone on an unrelated route", () => {
    renderAt("/carrito");

    for (const label of ["Explorar", "Vender", "Ingresar"]) {
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute("aria-current");
    }
  });

  it("keeps home from prefixing every route", () => {
    renderAt("/ingresar");

    expect(screen.getByRole("link", { name: "Explorar" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("aria-current", "page");
  });
});
