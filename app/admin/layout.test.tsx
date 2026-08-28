import { cleanup, render, screen } from "@testing-library/react";
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

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

const { default: AdminLayout } = await import("@/app/admin/layout");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSupabaseConfigured.mockReturnValue(true);
  mocks.createServerSupabaseClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
  });
});

afterEach(cleanup);

describe("AdminLayout", () => {
  it("redirects anonymous visitors to sign in", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    await expect(AdminLayout({ children: <p>Privado</p> })).rejects.toThrow("REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/ingresar?continuar=/admin/disputas");
  });

  it("redirects authenticated non-admins to the panel", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    mocks.rpc.mockResolvedValue({ data: false });

    await expect(AdminLayout({ children: <p>Privado</p> })).rejects.toThrow("REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/panel");
  });

  it("shows the admin section navigation after authorization", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "admin-1" } } });
    mocks.rpc.mockResolvedValue({ data: true });

    render(await AdminLayout({ children: <p>Privado</p> }));

    expect(screen.getByRole("link", { name: "Usuarios" })).toHaveAttribute("href", "/admin/usuarios");
    expect(screen.getByRole("link", { name: "Disputas" })).toHaveAttribute("href", "/admin/disputas");
    expect(screen.getByText("Privado")).toBeInTheDocument();
  });
});
