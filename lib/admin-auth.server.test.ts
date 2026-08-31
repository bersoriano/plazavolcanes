import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { getCurrentUserAdminStatus, requireAdmin } = await import("@/lib/admin-auth.server");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSupabaseConfigured.mockReturnValue(true);
  mocks.createServerSupabaseClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
  });
});

describe("requireAdmin", () => {
  it("reports administrator status only after an authenticated admin check", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "admin-1" } } });
    mocks.rpc.mockResolvedValue({ data: true });

    await expect(getCurrentUserAdminStatus()).resolves.toEqual({
      isAdmin: true,
      signedIn: true,
    });
  });

  it("redirects to the panel when Supabase is unconfigured", async () => {
    mocks.isSupabaseConfigured.mockReturnValue(false);

    await expect(requireAdmin()).rejects.toThrow("REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/panel");
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("redirects visitors without a claim subject to sign in", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/ingresar?continuar=/admin/usuarios",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("redirects authenticated non-admins to the panel", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    mocks.rpc.mockResolvedValue({ data: false });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/panel");
  });

  it("allows authenticated administrators", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "admin-1" } } });
    mocks.rpc.mockResolvedValue({ data: true });

    await expect(requireAdmin()).resolves.toBeUndefined();

    expect(mocks.rpc).toHaveBeenCalledWith("is_current_user_admin");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
