import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShopWorkspaceHeader } from "@/components/shops/shop-workspace-header";

afterEach(cleanup);

function renderHeader(props: Partial<Parameters<typeof ShopWorkspaceHeader>[0]> = {}) {
  return render(
    <ShopWorkspaceHeader active="catalogo" shopId={4} shopName="Casa Niebla" shopSlug="casa-niebla" {...props} />,
  );
}

describe("shop workspace header", () => {
  it("names the page after the shop", () => {
    renderHeader();

    expect(screen.getByRole("heading", { level: 1, name: "Casa Niebla" })).toBeInTheDocument();
  });

  it("links its two views", () => {
    renderHeader();

    const views = screen.getByRole("navigation", { name: "Secciones de la tienda" });

    expect(within(views).getByRole("link", { name: "Catálogo" })).toHaveAttribute(
      "href",
      "/panel/tiendas/4",
    );
    expect(within(views).getByRole("link", { name: "Ajustes" })).toHaveAttribute(
      "href",
      "/panel/tiendas/4/ajustes",
    );
  });

  it("marks the open view for assistive technology", () => {
    renderHeader({ active: "ajustes" });

    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Catálogo" })).not.toHaveAttribute("aria-current");
  });

  it("opens the public shop by its slug", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: /Ver tienda pública/ })).toHaveAttribute(
      "href",
      "/tiendas/casa-niebla",
    );
  });

  it("offers the way back to every shop", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: /Mis tiendas/ })).toHaveAttribute("href", "/panel");
  });

  it("reaches orders without a detour through the panel", () => {
    // A sale arrives while the seller is editing listings. Sending them back to
    // /panel first is the kind of detour that gets an order answered late.
    renderHeader();

    expect(screen.getByRole("link", { name: /Pedidos/ })).toHaveAttribute("href", "/panel/pedidos");
  });

  it("tells a distinguished seller their shop carries the distinction", () => {
    renderHeader({
      isPremium: true,
      shopName: "Casa Premium",
      shopSlug: "casa-premium",
    });

    expect(screen.getByRole("group", { name: "Tienda Premium" })).toBeInTheDocument();
    expect(screen.getByText(/Plaza Volcanes distinguió tu tienda/)).toBeInTheDocument();
  });

  it("says nothing about the distinction to an ordinary seller", () => {
    renderHeader();

    expect(screen.queryByRole("group", { name: "Tienda Premium" })).toBeNull();
  });
});
