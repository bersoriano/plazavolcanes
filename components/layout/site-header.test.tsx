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

  it("keeps the signed-out publish link at least 44px high", async () => {
    await renderHeader(false);

    expect(screen.getByRole("link", { name: "Publica tu tienda" })).toHaveClass(
      "hidden",
      "min-h-11",
      "items-center",
      "sm:inline-flex",
    );
  });
});
