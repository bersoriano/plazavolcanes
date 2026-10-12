import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();
const resumePurchaseIntent = vi.fn();
const configured = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => configured.value }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { exchangeCodeForSession, verifyOtp } }),
}));
vi.mock("@/lib/purchase-intent.server", () => ({ resumePurchaseIntent }));

const { GET } = await import("@/app/auth/confirm/route");

function requestFor(query: string) {
  return new Request(`https://plazavolcanes.com/auth/confirm${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  configured.value = true;
  const data = { user: { id: "user-1", email_confirmed_at: "2026-10-11T00:00:00Z" }, session: { access_token: "token" } };
  exchangeCodeForSession.mockResolvedValue({ data, error: null });
  verifyOtp.mockResolvedValue({ data, error: null });
  resumePurchaseIntent.mockResolvedValue(null);
});

describe("GET /auth/confirm", () => {
  it.each(["?code=abc&vender=1", "?token_hash=hash&type=signup&vender=1", "?token_hash=hash&type=signup&intent=vender"])("sends confirmed sellers to store creation for %s", async (query) => {
    const response = await GET(requestFor(query));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/panel/tiendas/nueva");
  });

  it("normalizes legacy seller intent when confirmation fails", async () => {
    const response = await GET(requestFor("?vender=1&continuar=%2Fmensajes"));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/ingresar?error=confirmacion&continuar=%2Fmensajes&intent=vender");
  });

  it.each(["https://evil.example", "//evil.example", "/%2fevil.example", "/\\evil.example", "/%5cevil.example"])("rejects unsafe confirmation continuation %s", async (continuar) => {
    const params = new URLSearchParams({ token_hash: "hash", type: "signup", intent: "vender", continuar });
    const response = await GET(requestFor(`?${params}`));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/panel/tiendas/nueva");
  });

  it("sends a confirmed account to the panel", async () => {
    const response = await GET(requestFor("?code=abc"));

    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/panel");
  });

  it("sends a confirmed seller to store creation", async () => {
    const response = await GET(requestFor("?code=abc&intent=vender"));

    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/panel/tiendas/nueva");
  });

  it("finishes a purchase that registration interrupted", async () => {
    resumePurchaseIntent.mockResolvedValue("/carrito/4");

    const response = await GET(requestFor("?token_hash=hash&type=signup"));

    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/carrito/4");
  });

  it("does not resume anything when the link cannot be verified", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });

    const response = await GET(requestFor("?code=spent"));

    expect(resumePurchaseIntent).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://plazavolcanes.com/ingresar?error=sesion_confirmacion",
    );
  });

  it("preserves seller and validated continuation when browser PKCE exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: null, error: { code: "pkce_code_verifier_not_found" } });
    const response = await GET(requestFor("?code=abc&intent=vender&continuar=%2Fmensajes%3Ftienda%3D4"));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/ingresar?error=sesion_confirmacion&continuar=%2Fmensajes%3Ftienda%3D4&intent=vender");
    expect(resumePurchaseIntent).not.toHaveBeenCalled();
  });

  it.each(["otp_expired", "token_already_used"])("offers recovery for %s without claiming confirmation", async (code) => {
    verifyOtp.mockResolvedValue({ data: null, error: { code } });
    const response = await GET(requestFor("?token_hash=spent&type=signup&intent=vender"));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/ingresar?error=confirmacion&intent=vender");
    expect(resumePurchaseIntent).not.toHaveBeenCalled();
  });

  it("does not treat an error-free response without a session as signed in", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-10-11" }, session: null }, error: null });
    const response = await GET(requestFor("?token_hash=hash&type=signup"));
    expect(response.headers.get("location")).toContain("/ingresar?error=sesion_confirmacion");
    expect(resumePurchaseIntent).not.toHaveBeenCalled();
  });

  it("requires authoritative confirmed-email evidence before continuing", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { email_confirmed_at: null }, session: { access_token: "token" } }, error: null });
    const response = await GET(requestFor("?code=abc"));
    expect(response.headers.get("location")).toContain("/ingresar?error=confirmacion");
    expect(resumePurchaseIntent).not.toHaveBeenCalled();
  });

  it("handles thrown session failures with an actionable recovery destination", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("cookie write failed"));
    const response = await GET(requestFor("?code=abc&intent=vender"));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/ingresar?error=sesion_confirmacion&intent=vender");
  });

  it.each(["recovery", "email_change", "invite", "sms", "unknown"])("does not accept %s tokens at signup confirmation", async (type) => {
    const response = await GET(requestFor(`?token_hash=hash&type=${type}`));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/ingresar?error=confirmacion");
  });

  it("keeps legacy email-token confirmation working", async () => {
    const response = await GET(requestFor("?token_hash=hash&type=email&intent=vender"));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/panel/tiendas/nueva");
  });

  it("lets purchase resumption win over both seller intent and continuation", async () => {
    resumePurchaseIntent.mockResolvedValue("/carrito/4");
    const response = await GET(requestFor("?code=abc&intent=vender&continuar=%2Fmensajes"));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/carrito/4");
  });

  it("preserves safe continuation on success before seller destination", async () => {
    const response = await GET(requestFor("?code=abc&intent=vender&continuar=%2Fmensajes"));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/mensajes");
  });

  it("drops unsafe continuation and secrets from recovery redirects", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: "bad_code" } });
    const response = await GET(requestFor("?code=secret&continuar=https://evil.example&email=ana@correo.com&intent=vender"));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/ingresar?error=sesion_confirmacion&intent=vender");
  });

  it("keeps missing-token links in recovery even if another account is signed in", async () => {
    const response = await GET(requestFor("?intent=vender"));
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/ingresar?error=confirmacion&intent=vender");
    expect(resumePurchaseIntent).not.toHaveBeenCalled();
  });
});
