import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pageContainer } from "@/components/layout/container";
import { SiteHeader } from "@/components/layout/site-header";

const auth = { admin: false, signedIn: false };
const route = { pathname: "/" };

vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/admin-auth.server", () => ({
  getCurrentUserAdminStatus: vi.fn(async () => ({
    isAdmin: auth.signedIn && auth.admin,
    signedIn: auth.signedIn,
  })),
}));
vi.mock("@/lib/queries/messages.server", () => ({ fetchUnreadCount: vi.fn(async () => 0) }));

afterEach(() => {
  cleanup();
  route.pathname = "/";
});

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
    // there is room for words instead of a row of unlabelled glyphs. At md
    // they sit closer together, which is what keeps the row inside 768px.
    for (const name of ["Explorar", "Mi panel", "Mis compras", "Mensajes"]) {
      expect(within(navigation).getByRole("link", { name })).toHaveClass(
        "hidden",
        "min-h-11",
        "md:inline-flex",
        "px-3",
        "lg:px-4",
      );
    }
  });

  it("lets a signed-in visitor browse the plaza from the header", async () => {
    await renderHeader(true);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    const links = within(navigation).getAllByRole("link");
    expect(links[0]).toHaveTextContent("Explorar");
    expect(links[0]).toHaveAttribute("href", "/explorar");
  });

  it("marks the signed-in destination the visitor is on", async () => {
    route.pathname = "/compras/42";
    await renderHeader(true);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(within(navigation).getByRole("link", { name: "Mis compras" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "Mi panel" })).not.toHaveAttribute("aria-current");
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

  it("lays its row out in the box every app screen shares", async () => {
    route.pathname = "/compras";

    // Same classes as the page below, signed in or not, so the logo and
    // "Salir" sit exactly over the content's edges.
    for (const signedIn of [true, false]) {
      await renderHeader(signedIn);
      const row = document.querySelector("[data-site-header] > div");
      expect(row).toHaveClass(...pageContainer.split(" "));
      expect(row).not.toHaveClass("xl:px-20");
      cleanup();
    }
  });

  it("widens its gutters to the landing's grid on the landing pages", async () => {
    for (const pathname of ["/", "/vender"]) {
      route.pathname = pathname;
      for (const signedIn of [true, false]) {
        await renderHeader(signedIn);
        expect(document.querySelector("[data-site-header] > div")).toHaveClass("xl:px-20");
        cleanup();
      }
    }
  });

  it("reveals the full brand separately from signed-in action labels", async () => {
    await renderHeader(true);

    expect(screen.getByText("Plaza Volcanes")).toHaveClass("sm:inline");
  });

  it("keeps signed-out access named without relying on its visible label", async () => {
    await renderHeader(false);

    expect(screen.getAllByRole("link", { name: "Ingresar" })[0]).toHaveAttribute("aria-label", "Ingresar");
  });

  it("links the same destinations on every page for a signed-out visitor", async () => {
    for (const pathname of ["/", "/explorar", "/vender", "/compras"]) {
      route.pathname = pathname;
      await renderHeader(false);

      const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
      expect(within(navigation).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
        ["Explorar", "/explorar"],
        ["Cómo comprar", "/como-comprar"],
        ["Vender", "/vender?desde=header"],
      ]);
      cleanup();
    }
  });

  it("marks the signed-out destination the visitor is on", async () => {
    route.pathname = "/vender";
    await renderHeader(false);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(within(navigation).getByRole("link", { name: "Vender" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "Explorar" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing on the landing, which is home rather than a destination", async () => {
    await renderHeader(false);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    for (const link of within(navigation).getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("offers to create a store, straight to signup, from every page", async () => {
    for (const pathname of ["/", "/explorar", "/vender"]) {
      route.pathname = pathname;
      await renderHeader(false);

      const pills = screen.getAllByRole("link", { name: "Crear mi tienda" });
      for (const pill of pills) {
        expect(pill).toHaveAttribute("href", "/registro?vender=1&desde=header");
      }
      cleanup();
    }
  });

  it("leaves a phone's header to the brand and the menu", async () => {
    await renderHeader(false);

    // The closed sheet is out of the accessibility tree, so these are the
    // header's own. The quick access bar holds Explorar, Vender and Ingresar
    // on a phone.
    const signIn = screen.getAllByRole("link", { name: "Ingresar" });
    const pill = screen.getAllByRole("link", { name: "Crear mi tienda" });
    expect(signIn).toHaveLength(1);
    expect(signIn[0]).toHaveClass("hidden", "sm:inline-flex");
    expect(pill).toHaveLength(1);
    expect(pill[0]).toHaveClass("hidden", "h-12", "sm:inline-flex");
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toHaveClass("hidden", "lg:flex");
  });

  it("opens the destinations, Ingresar and the pill from a named menu button below lg", async () => {
    route.pathname = "/explorar";
    await renderHeader(false);

    const button = screen.getByRole("button", { name: "Abrir menú" });
    expect(button).toHaveAttribute("popovertarget", "menu-principal");
    expect(button).toHaveClass("tap", "lg:hidden");

    // Closed until the button opens it, so it is queried as hidden.
    const sheet = screen.getByRole("dialog", { hidden: true });
    expect(sheet).toHaveAttribute("aria-label", "Menú");
    expect(within(sheet).getAllByRole("link", { hidden: true }).map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Explorar", "/explorar"],
      ["Cómo comprar", "/como-comprar"],
      ["Vender", "/vender?desde=header"],
      ["Ingresar", "/ingresar"],
      ["Crear mi tienda", "/registro?vender=1&desde=header"],
    ]);
    expect(within(sheet).getByRole("link", { hidden: true, name: "Explorar" })).toHaveAttribute("aria-current", "page");
  });

  it("leaves the signed-in header without the menu or the selling pill, on any page", async () => {
    for (const pathname of ["/", "/vender"]) {
      route.pathname = pathname;
      await renderHeader(true);

      expect(screen.queryByRole("button", { name: "Abrir menú" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Crear mi tienda" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Salir" })).toBeInTheDocument();
      cleanup();
    }
  });
});
