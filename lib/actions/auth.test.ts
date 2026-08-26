import { beforeEach, describe, expect, it, vi } from "vitest";

const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const getClaims = vi.fn();
const redirect = vi.hoisted(() => vi.fn());
const configured = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { resetPasswordForEmail, updateUser, getClaims },
  }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => configured.value }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const { requestPasswordReset, updatePassword } = await import("@/lib/actions/auth");

const idle = { status: "idle" as const, message: "" };

function formOf(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  configured.value = true;
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  resetPasswordForEmail.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ error: null });
});

describe("requestPasswordReset", () => {
  it("sends the recovery link to the route that verifies it", async () => {
    await requestPasswordReset(idle, formOf({ email: "ana@correo.com" }));

    expect(resetPasswordForEmail).toHaveBeenCalledWith("ana@correo.com", {
      redirectTo: "https://plazavolcanes.com/auth/recuperar",
    });
  });

  it("answers the same way for an address that has no account", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: "User not found" } });

    const rejected = await requestPasswordReset(idle, formOf({ email: "nadie@correo.com" }));

    resetPasswordForEmail.mockResolvedValue({ error: null });
    const accepted = await requestPasswordReset(idle, formOf({ email: "ana@correo.com" }));

    expect(rejected).toEqual(accepted);
    expect(rejected.status).toBe("success");
  });

  it("rejects a malformed address without asking Supabase", async () => {
    const state = await requestPasswordReset(idle, formOf({ email: "ana" }));

    expect(state.status).toBe("error");
    expect(state.errors?.email?.[0]).toBe("Escribe un correo válido.");
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("explains the missing configuration instead of failing", async () => {
    configured.value = false;

    const state = await requestPasswordReset(idle, formOf({ email: "ana@correo.com" }));

    expect(state.status).toBe("error");
    expect(state.message).toContain("Supabase");
  });
});

describe("updatePassword", () => {
  const valid = { password: "volcanes2026", password_confirm: "volcanes2026" };

  it("saves the new password and sends the person to their panel", async () => {
    await updatePassword(idle, formOf(valid));

    expect(updateUser).toHaveBeenCalledWith({ password: "volcanes2026" });
    expect(redirect).toHaveBeenCalledWith("/panel");
  });

  it("refuses when the recovery link no longer carries a session", async () => {
    getClaims.mockResolvedValue({ data: null });

    const state = await updatePassword(idle, formOf(valid));

    expect(state.status).toBe("error");
    expect(state.message).toContain("enlace");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("reports a mismatch without asking Supabase", async () => {
    const state = await updatePassword(
      idle,
      formOf({ password: "volcanes2026", password_confirm: "volcanes2027" }),
    );

    expect(state.errors?.password_confirm?.[0]).toBe("Las contraseñas no coinciden.");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("keeps the person on the form when Supabase rejects the password", async () => {
    updateUser.mockResolvedValue({ error: { message: "New password should be different" } });

    const state = await updatePassword(idle, formOf(valid));

    expect(state.status).toBe("error");
    expect(redirect).not.toHaveBeenCalled();
  });
});
