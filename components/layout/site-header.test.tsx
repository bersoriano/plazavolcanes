import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/layout/site-header";

const auth = { admin: false, signedIn: false };

vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/admin-auth.server", () => ({
  getCurrentUserAdminStatus: vi.fn(async () => ({
    isAdmin: auth.signedIn && auth.admin,
    signedIn: auth.signedIn,
  })),
}));
vi.mock("@/lib/queries/messages.server", () => ({ fetchUnreadCount: vi.fn(async () => 0) }));

afterEach(cleanup);

async function renderHeader(signedIn: boolean, admin = false) {
  auth.admin = admin;
  auth.signedIn = signedIn;
  render(await SiteHeader());
}

describe("SiteHeader", () => {
  it("shows protected admin routes only to administrators", async () => {
    await renderHeader(true, true);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(within(navigation).getByRole("link", { name: "Usuarios" })).toHaveAttribute(
      "href",
      "/admin/usuarios",
    );
    expect(within(navigation).getByRole("link", { name: "Disputas" })).toHaveAttribute(
      "href",
      "/admin/disputas",
    );
  });

  it("hides protected admin routes from non-administrators", async () => {
    await renderHeader(true);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(within(navigation).queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "Disputas" })).not.toBeInTheDocument();
  });

  it("keeps the compact home control at least 44px in both dimensions", async () => {
    await renderHeader(false);

    expect(screen.getByRole("link", { name: "Plaza Volcanes, inicio" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
  });

  it("keeps the signed-in account control named", async () => {
    await renderHeader(true);

    expect(screen.getByRole("link", { name: "Plaza Volcanes, inicio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salir" })).toHaveAttribute("aria-label", "Salir");
  });

  it("hands the destinations to the quick access bar until the medium breakpoint", async () => {
    await renderHeader(true);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });

    // The bar carries these on a phone, so the header only shows them once
    // there is room for words instead of a row of unlabelled glyphs.
    for (const name of ["Mi panel", "Mis compras", "Mensajes"]) {
      expect(within(navigation).getByRole("link", { name })).toHaveClass(
        "hidden",
        "min-h-11",
        "md:inline-flex",
      );
    }
  });

  it("keeps administration reachable from the header at every width", async () => {
    await renderHeader(true, true);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });

    // Nothing in the quick access bar points at /admin, so these may not hide.
    for (const name of ["Usuarios", "Disputas"]) {
      const link = within(navigation).getByRole("link", { name });
      expect(link).toHaveClass("tap");
      expect(link).not.toHaveClass("hidden");
    }
  });

  it("reveals the full brand separately from signed-in action labels", async () => {
    await renderHeader(true);

    expect(screen.getByText("Plaza Volcanes")).toHaveClass("sm:inline");
  });

  it("keeps signed-out access named without relying on its visible label", async () => {
    await renderHeader(false);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(within(navigation).getByRole("link", { name: "Ingresar" })).toHaveAttribute(
      "aria-label",
      "Ingresar",
    );
  });

  it("sends a signed-out visitor to the seller landing, not straight to signup", async () => {
    await renderHeader(false);

    expect(screen.getByRole("link", { name: "Vender" })).toHaveAttribute(
      "href",
      "/vender?desde=header",
    );
  });

  it("keeps the phone's selling pill at least 44px high and hands wider screens the full button", async () => {
    await renderHeader(false);

    expect(screen.getByRole("link", { name: "Vender" })).toHaveClass("inline-flex", "min-h-11", "sm:hidden");
    const open = screen.getByRole("link", { name: "Abrir mi tienda" });
    expect(open).toHaveAttribute("href", "/vender?desde=header");
    expect(open).toHaveClass("hidden", "h-12", "sm:inline-flex");
  });

  it("links the home page's sections from any page for a signed-out visitor", async () => {
    await renderHeader(false);

    const sections = screen.getByRole("navigation", { name: "Secciones de la plaza" });
    expect(within(sections).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Explorar", "/#explorar"],
      ["Tiendas", "/#tiendas"],
      ["Cómo funciona", "/#pasos"],
      ["Para vender", "/#vender"],
    ]);
  });

  it("opens the same sections from a named menu button below lg", async () => {
    await renderHeader(false);

    const button = screen.getByRole("button", { name: "Abrir menú" });
    expect(button).toHaveAttribute("popovertarget", "menu-principal");
    expect(button).toHaveClass("tap", "lg:hidden");
  });

  it("leaves the signed-in header without the landing's section links or menu", async () => {
    await renderHeader(true);

    expect(screen.queryByRole("navigation", { name: "Secciones de la plaza" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir menú" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir mi tienda" })).not.toBeInTheDocument();
  });
});
