import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const redirect = vi.hoisted(() => vi.fn());
const configured = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => configured.value }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getClaims } }),
}));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn() }));
vi.mock("@/lib/actions/auth", () => ({
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
}));

const { default: NewPasswordPage } = await import("@/app/(auth)/nueva-contrasena/page");

beforeEach(() => {
  vi.clearAllMocks();
  configured.value = true;
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
});

afterEach(cleanup);

describe("New password page", () => {
  it("shows the form to someone arriving with a recovery session", async () => {
    render(await NewPasswordPage());

    expect(screen.getByLabelText("Contraseña nueva")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("turns away a visitor whose link never established a session", async () => {
    getClaims.mockResolvedValue({ data: null });

    await NewPasswordPage();

    expect(redirect).toHaveBeenCalledWith("/ingresar?error=recuperacion");
  });
});
