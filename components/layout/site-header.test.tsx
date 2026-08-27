import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/layout/site-header";

const auth = { signedIn: false };

vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/queries/messages.server", () => ({ fetchUnreadCount: vi.fn(async () => 0) }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => auth.signedIn }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getClaims: vi.fn(async () => ({ data: { claims: auth.signedIn ? {} : null } })) },
  })),
}));

afterEach(cleanup);

async function renderHeader(signedIn: boolean) {
  auth.signedIn = signedIn;
  render(await SiteHeader());
}

describe("SiteHeader", () => {
  it("keeps the compact home control at least 44px in both dimensions", async () => {
    await renderHeader(false);

    expect(screen.getByRole("link", { name: "Plaza Volcanes, inicio" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
  });

  it("keeps compact signed-in actions explicitly named", async () => {
    await renderHeader(true);

    expect(screen.getByRole("link", { name: "Plaza Volcanes, inicio" })).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(within(navigation).getByRole("link", { name: "Mi panel" })).toHaveAttribute(
      "aria-label",
      "Mi panel",
    );
    expect(within(navigation).getByRole("link", { name: "Mensajes" })).toHaveAttribute(
      "aria-label",
      "Mensajes",
    );
    expect(within(navigation).getByRole("button", { name: "Salir" })).toHaveAttribute(
      "aria-label",
      "Salir",
    );
  });

  it("keeps signed-in actions compact until the medium breakpoint", async () => {
    await renderHeader(true);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    const panel = within(navigation).getByRole("link", { name: "Mi panel" });
    const messages = within(navigation).getByRole("link", { name: "Mensajes" });
    const signOut = within(navigation).getByRole("button", { name: "Salir" });

    expect(panel).toHaveClass("md:inline-flex", "md:min-w-0");
    expect(panel.querySelector("svg")).toHaveClass("md:hidden");
    expect(within(panel).getByText("Mi panel")).toHaveClass("md:inline");
    expect(messages).toHaveClass("md:inline-flex", "md:min-w-0");
    expect(within(messages).getByText("Mensajes")).toHaveClass("md:inline");
    expect(within(signOut).getByText("Salir")).toHaveClass("md:inline");
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
