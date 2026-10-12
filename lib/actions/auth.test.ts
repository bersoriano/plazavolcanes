import { beforeEach, describe, expect, it, vi } from "vitest";

const resetPasswordForEmail = vi.fn();
const signInWithPassword = vi.fn();
const signUpWithPassword = vi.fn();
const resumePurchaseIntent = vi.fn();
const readPurchaseIntent = vi.fn();
const updateUser = vi.fn();
const getClaims = vi.fn();
const resend = vi.fn();
const redirect = vi.hoisted(() => vi.fn());
const configured = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      resetPasswordForEmail,
      updateUser,
      getClaims,
      signInWithPassword,
      signUp: signUpWithPassword,
      resend,
    },
  }),
}));
vi.mock("@/lib/purchase-intent.server", () => ({ resumePurchaseIntent, readPurchaseIntent }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => configured.value }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const { requestPasswordReset, resendConfirmation, signIn, signUp, updatePassword } = await import(
  "@/lib/actions/auth"
);

const idle = { status: "idle" as const, message: "" };

function formOf(entries: Record<string, string | undefined>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  configured.value = true;
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  resetPasswordForEmail.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ error: null });
  signInWithPassword.mockResolvedValue({ error: null });
  signUpWithPassword.mockResolvedValue({ data: { session: { user: {} } }, error: null });
  resumePurchaseIntent.mockResolvedValue(null);
  readPurchaseIntent.mockResolvedValue(null);
  resend.mockResolvedValue({ error: null });
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

const credentials = { email: "ana@correo.com", password: "volcanes2026" };

describe.each([signIn, signUp])("authentication destination precedence (%#)", (authenticate) => {
  const account = { ...credentials, phone: "3312345678", display_name: "Ana Ruiz" };

  it.each([{ intent: "vender" }, { vender: "1" }])("sends %j to store creation", async (intent) => {
    await authenticate(idle, formOf({ ...account, ...intent }));
    expect(redirect).toHaveBeenCalledWith("/panel/tiendas/nueva");
  });

  it("lets a purchase win over continuation and seller intent", async () => {
    resumePurchaseIntent.mockResolvedValue("/carrito/4");
    await authenticate(idle, formOf({ ...account, continuar: "/mensajes", intent: "vender" }));
    expect(redirect).toHaveBeenCalledWith("/carrito/4");
  });

  it("lets a validated continuation win over seller intent", async () => {
    await authenticate(idle, formOf({ ...account, continuar: "/mensajes?tienda=4", intent: "vender" }));
    expect(redirect).toHaveBeenCalledWith("/mensajes?tienda=4");
  });

  it.each(["https://evil.example", "//evil.example", "/%2fevil.example", "/\\evil.example", "/%5cevil.example"])("rejects unsafe continuation %s and uses seller destination", async (continuar) => {
    await authenticate(idle, formOf({ ...account, continuar, intent: "vender" }));
    expect(redirect).toHaveBeenCalledWith("/panel/tiendas/nueva");
  });

  it("keeps ordinary buyers on the panel", async () => {
    await authenticate(idle, formOf(account));
    expect(redirect).toHaveBeenCalledWith("/panel");
  });
});

describe("signIn destinations", () => {
  it("finishes an interrupted purchase and opens that shop's cart", async () => {
    resumePurchaseIntent.mockResolvedValue("/carrito/4");

    await signIn(idle, formOf(credentials));

    expect(redirect).toHaveBeenCalledWith("/carrito/4");
  });

  it("still goes to the panel for an ordinary sign-in", async () => {
    await signIn(idle, formOf(credentials));

    expect(redirect).toHaveBeenCalledWith("/panel");
  });

  it("honours a continuation the app itself put in the form", async () => {
    await signIn(idle, formOf({ ...credentials, continuar: "/mensajes" }));

    expect(redirect).toHaveBeenCalledWith("/mensajes");
  });

  it("sends seller intent to store creation after sign-in", async () => {
    await signIn(idle, formOf({ ...credentials, intent: "vender" }));

    expect(redirect).toHaveBeenCalledWith("/panel/tiendas/nueva");
  });

  it("ignores a continuation pointing at another site", async () => {
    await signIn(idle, formOf({ ...credentials, continuar: "https://evil.example/steal" }));

    expect(redirect).toHaveBeenCalledWith("/panel");
  });

  it("lets a pending purchase win over a continuation field", async () => {
    resumePurchaseIntent.mockResolvedValue("/carrito/4");

    await signIn(idle, formOf({ ...credentials, continuar: "/mensajes" }));

    expect(redirect).toHaveBeenCalledWith("/carrito/4");
  });

  it("does not resume anything when the credentials are wrong", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    const state = await signIn(idle, formOf(credentials));

    expect(state.status).toBe("error");
    expect(resumePurchaseIntent).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("guides a correct-password user whose email is still unconfirmed", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed" } });
    const state = await signIn(idle, formOf(credentials));
    expect(state.message).toMatch(/confirma tu correo/i);
    expect(state.message).toMatch(/reenviar/i);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("resumes a purchase before seller recovery intent", async () => {
    resumePurchaseIntent.mockResolvedValue("/carrito/4");
    await signIn(idle, formOf({ ...credentials, intent: "vender", continuar: "/mensajes" }));
    expect(redirect).toHaveBeenCalledWith("/carrito/4");
  });
});

describe("signUp destinations", () => {
  const registration = {
    ...credentials,
    phone: "3312345678",
    display_name: "Ana Ruiz",
  };

  it("finishes an interrupted purchase when the account starts signed in", async () => {
    resumePurchaseIntent.mockResolvedValue("/carrito/4");

    await signUp(idle, formOf(registration));

    expect(redirect).toHaveBeenCalledWith("/carrito/4");
  });

  it("keeps the pending purchase for after e-mail confirmation", async () => {
    signUpWithPassword.mockResolvedValue({ data: { session: null }, error: null });
    readPurchaseIntent.mockResolvedValue({ productId: 12, quantity: 1, productPath: null });

    const state = await signUp(idle, formOf(registration));

    expect(state.status).toBe("success");
    expect(state.message).toContain("compra");
    expect(resumePurchaseIntent).not.toHaveBeenCalled();
  });

  it("uses the plain confirmation message when nobody was buying", async () => {
    signUpWithPassword.mockResolvedValue({ data: { session: null }, error: null });

    const state = await signUp(idle, formOf(registration));

    expect(state.message).toBe("Revisa tu correo para confirmar tu cuenta.");
    expect(state.confirmationEmail).toBe(credentials.email);
    expect(JSON.stringify(state)).not.toContain(credentials.password);
  });

  it("builds a query-bearing template target preserving seller continuation", async () => {
    signUpWithPassword.mockResolvedValue({ data: { session: null }, error: null });
    await signUp(idle, formOf({ ...registration, intent: "vender", continuar: "/mensajes?tienda=4" }));
    expect(signUpWithPassword.mock.calls[0][0].options.emailRedirectTo).toBe("https://plazavolcanes.com/auth/confirm?type=signup&continuar=%2Fmensajes%3Ftienda%3D4&intent=vender");
  });
});

describe("resendConfirmation", () => {
  it.each([signUp, resendConfirmation])("normalizes legacy seller intent in confirmation links (%#)", async (action) => {
    await action(idle, formOf({ ...credentials, phone: "3312345678", display_name: "Ana Ruiz", vender: "1" }));
    const call = action === signUp ? signUpWithPassword.mock.calls[0][0] : resend.mock.calls[0][0];
    expect(call.options.emailRedirectTo).toBe("https://plazavolcanes.com/auth/confirm?type=signup&intent=vender");
  });

  it("resends signup confirmation with validated seller context", async () => {
    const state = await resendConfirmation(idle, formOf({ email: "ana@correo.com", intent: "vender", continuar: "/mensajes" }));
    expect(state.status).toBe("success");
    expect(resend).toHaveBeenCalledWith({ type: "signup", email: "ana@correo.com", options: { emailRedirectTo: "https://plazavolcanes.com/auth/confirm?type=signup&continuar=%2Fmensajes&intent=vender" } });
  });

  it.each(["user_not_found", "email_already_confirmed", "over_email_send_rate_limit"])("does not expose %s", async (code) => {
    const accepted = await resendConfirmation(idle, formOf({ email: "ana@correo.com" }));
    resend.mockResolvedValue({ error: { code, message: "private provider detail" } });
    const rejected = await resendConfirmation(idle, formOf({ email: "nadie@correo.com" }));
    expect(rejected).toEqual(accepted);
    expect(rejected.message).toMatch(/^Si /);
  });

  it("keeps thrown provider failures private", async () => {
    const accepted = await resendConfirmation(idle, formOf({ email: "ana@correo.com" }));
    resend.mockRejectedValue(new Error("network failure"));
    expect(await resendConfirmation(idle, formOf({ email: "nadie@correo.com" }))).toEqual(accepted);
  });

  it("rejects malformed emails before contacting the provider", async () => {
    const state = await resendConfirmation(idle, formOf({ email: "bad" }));
    expect(state.errors?.email).toBeDefined();
    expect(resend).not.toHaveBeenCalled();
  });

  it("drops unsafe continuation from new links", async () => {
    await resendConfirmation(idle, formOf({ email: "ana@correo.com", continuar: "//evil.example", intent: "vender" }));
    expect(resend.mock.calls[0][0].options.emailRedirectTo).toBe("https://plazavolcanes.com/auth/confirm?type=signup&intent=vender");
  });
});
