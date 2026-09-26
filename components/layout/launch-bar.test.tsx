import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LaunchBar } from "@/components/layout/launch-bar";
import { FOUNDERS_CAP } from "@/lib/launch";
import { LAUNCH_BAR_DISMISS_COOKIE } from "@/lib/launch-bar";

const state = { dismissed: false, ownsShop: false, pathname: "/", promoActive: true };

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === LAUNCH_BAR_DISMISS_COOKIE && state.dismissed ? { name, value: "1" } : undefined,
  })),
}));
vi.mock("@/lib/queries/seller-standing.server", () => ({
  viewerOwnsAnyShop: vi.fn(async () => state.ownsShop),
}));
vi.mock("@/lib/launch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/launch")>()),
  isFoundersPromoActive: () => state.promoActive,
}));
vi.mock("@/lib/actions/launch-bar", () => ({ dismissLaunchBar: vi.fn(async () => {}) }));

beforeEach(() => {
  state.dismissed = false;
  state.ownsShop = false;
  state.pathname = "/";
  state.promoActive = true;
});

afterEach(cleanup);

async function renderBar(props: { spotsTaken?: number | null } = {}) {
  render(await LaunchBar(props));
}

function bar() {
  return screen.queryByRole("complementary", { name: "Promoción de lanzamiento" });
}

describe("LaunchBar", () => {
  it("names the cap and points at the landing page", async () => {
    await renderBar();

    expect(bar()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vender →" })).toHaveAttribute(
      "href",
      "/vender?desde=barra",
    );
    expect(bar()).toHaveTextContent(`0% comisión para las primeras ${FOUNDERS_CAP} tiendas`);
    expect(bar()).toHaveTextContent(`0% comisión · primeras ${FOUNDERS_CAP} tiendas`);
  });

  it("shows no tally while nothing counts the spots", async () => {
    await renderBar();

    expect(bar()).not.toHaveTextContent(/Quedan/);
  });

  it("counts down the remaining spots once a count arrives", async () => {
    await renderBar({ spotsTaken: 2 });

    expect(bar()).toHaveTextContent(`Quedan ${FOUNDERS_CAP - 2} lugares fundadores`);
  });

  it("stops asking once the cap is reached", async () => {
    await renderBar({ spotsTaken: FOUNDERS_CAP });

    expect(bar()).not.toBeInTheDocument();
  });

  it("comes down once the founders promotion has ended", async () => {
    state.promoActive = false;
    await renderBar();

    expect(bar()).not.toBeInTheDocument();
  });

  it("leaves somebody who already runs a shop alone", async () => {
    state.ownsShop = true;
    await renderBar();

    expect(bar()).not.toBeInTheDocument();
  });

  it("stays away once this browser has dismissed it", async () => {
    state.dismissed = true;
    await renderBar();

    expect(bar()).not.toBeInTheDocument();
  });

  it("offers a 44px close control a screen reader can name", async () => {
    await renderBar();

    const close = screen.getByRole("button", { name: "Cerrar aviso" });

    expect(close).toHaveAttribute("type", "submit");
    expect(close).toHaveClass("tap-halo");
  });

  it("keeps to a single line", async () => {
    await renderBar({ spotsTaken: 2 });

    expect(bar()?.firstElementChild).toHaveClass("h-10", "overflow-hidden");
    for (const node of [
      screen.getByRole("link", { name: "Vender →" }),
      bar()!.querySelector("p")!,
    ]) {
      expect(node.className).toMatch(/whitespace-nowrap/);
    }
  });

  it("clears the notch on a phone", async () => {
    await renderBar();

    expect(bar()).toHaveClass("pt-[env(safe-area-inset-top)]");
  });

  for (const pathname of [
    "/vender",
    "/vender/algo",
    "/registro",
    "/ingresar",
    "/recuperar",
    "/nueva-contrasena",
    "/auth/confirm",
    "/panel",
    "/panel/productos/3/editar",
    "/admin/usuarios",
  ]) {
    it(`keeps out of ${pathname}`, async () => {
      state.pathname = pathname;
      await renderBar();

      expect(bar()).not.toBeInTheDocument();
    });
  }

  for (const pathname of ["/", "/productos/taza", "/tiendas/mi-tienda", "/carrito"]) {
    it(`still greets a visitor on ${pathname}`, async () => {
      state.pathname = pathname;
      await renderBar();

      expect(bar()).toBeInTheDocument();
    });
  }
});
