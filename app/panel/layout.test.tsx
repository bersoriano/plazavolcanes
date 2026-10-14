import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  rpc: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, usePathname: () => "/panel/pedidos" }));
vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

const { default: PanelLayout } = await import("@/app/panel/layout");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSupabaseConfigured.mockReturnValue(true);
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "seller-1" } } });
  mocks.rpc.mockResolvedValue({ data: null });
  mocks.createServerSupabaseClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
  });
});

afterEach(cleanup);

describe("PanelLayout", () => {
  it("sends anonymous visitors to sign in, and back to the panel after", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    await expect(PanelLayout({ children: <p>Privado</p> })).rejects.toThrow("REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/ingresar?continuar=/panel");
  });

  it("puts the panel's areas above every page in it", async () => {
    // A sale arrives while the seller is editing listings. Orders have to be
    // one tap away from wherever they are, not a detour through the summary.
    render(await PanelLayout({ children: <p>Privado</p> }));

    const bar = screen.getByRole("navigation", { name: "Secciones del panel" });
    expect(within(bar).getByRole("link", { name: "Pedidos" })).toHaveAttribute("href", "/panel/pedidos");
    expect(within(bar).getByRole("link", { name: "Cuenta" })).toHaveAttribute("href", "/panel/cuenta");
    expect(bar.compareDocumentPosition(screen.getByText("Privado")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("still opens the panel when the presence ping fails", async () => {
    mocks.rpc.mockRejectedValue(new Error("offline"));

    render(await PanelLayout({ children: <p>Privado</p> }));

    expect(screen.getByText("Privado")).toBeInTheDocument();
  });

  it("offers no panel navigation before Supabase is connected", async () => {
    mocks.isSupabaseConfigured.mockReturnValue(false);

    render(await PanelLayout({ children: <p>Privado</p> }));

    expect(screen.queryByRole("navigation", { name: "Secciones del panel" })).toBeNull();
    expect(screen.queryByText("Privado")).toBeNull();
  });
});
