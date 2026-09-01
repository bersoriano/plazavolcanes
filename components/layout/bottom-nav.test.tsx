import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BottomNav } from "@/components/layout/bottom-nav";

const auth = { signedIn: false, unread: 0 };

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/admin-auth.server", () => ({
  getCurrentUserAdminStatus: vi.fn(async () => ({ isAdmin: false, signedIn: auth.signedIn })),
}));
vi.mock("@/lib/queries/messages.server", () => ({
  fetchUnreadCount: vi.fn(async () => auth.unread),
}));

afterEach(cleanup);

async function renderBar(signedIn: boolean, unread = 0) {
  auth.signedIn = signedIn;
  auth.unread = unread;
  render(await BottomNav());
}

describe("BottomNav", () => {
  it("gives a signed-in shopper the destinations the header cannot hold", async () => {
    await renderBar(true);

    const bar = screen.getByRole("navigation", { name: "Navegación rápida" });

    // /compras had no link at all below the small breakpoint before the bar.
    for (const [name, href] of [
      ["Explorar", "/"],
      ["Mensajes", "/mensajes"],
      ["Compras", "/compras"],
      ["Panel", "/panel"],
    ] as const) {
      expect(within(bar).getByRole("link", { name: new RegExp(name) })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  it("points a signed-out visitor at the two things they can do", async () => {
    await renderBar(false);

    const bar = screen.getByRole("navigation", { name: "Navegación rápida" });

    expect(within(bar).getByRole("link", { name: "Vender" })).toHaveAttribute("href", "/vender");
    expect(within(bar).getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/ingresar");
    expect(within(bar).queryByRole("link", { name: "Compras" })).not.toBeInTheDocument();
  });

  it("counts unread messages where a screen reader can hear it", async () => {
    await renderBar(true, 3);

    const bar = screen.getByRole("navigation", { name: "Navegación rápida" });

    expect(within(bar).getByText("3 mensajes sin leer")).toBeInTheDocument();
  });

  it("caps the badge so a long count cannot widen the target", async () => {
    await renderBar(true, 42);

    const bar = screen.getByRole("navigation", { name: "Navegación rápida" });

    expect(within(bar).getByText("9+")).toBeInTheDocument();
    expect(within(bar).getByText("42 mensajes sin leer")).toBeInTheDocument();
  });

  it("keeps every entry at least 44px and steps aside on a wide screen", async () => {
    await renderBar(true);

    const bar = screen.getByRole("navigation", { name: "Navegación rápida" });

    expect(bar).toHaveClass("fixed", "md:hidden");
    for (const link of within(bar).getAllByRole("link")) {
      expect(link).toHaveClass("tap", "h-18");
    }
  });

  it("marks the destination the reader is already on", async () => {
    await renderBar(true);

    const bar = screen.getByRole("navigation", { name: "Navegación rápida" });

    expect(within(bar).getByRole("link", { name: /Explorar/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(bar).getByRole("link", { name: /Panel/ })).not.toHaveAttribute("aria-current");
  });
});
