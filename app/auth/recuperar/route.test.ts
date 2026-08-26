import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();
const configured = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => configured.value }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { exchangeCodeForSession, verifyOtp } }),
}));

const { GET } = await import("@/app/auth/recuperar/route");

function requestFor(query: string) {
  return new Request(`https://plazavolcanes.com/auth/recuperar${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  configured.value = true;
  exchangeCodeForSession.mockResolvedValue({ error: null });
  verifyOtp.mockResolvedValue({ error: null });
});

describe("GET /auth/recuperar", () => {
  it("exchanges a code and opens the form for a new password", async () => {
    const response = await GET(requestFor("?code=abc123"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/nueva-contrasena");
  });

  it("verifies a recovery token hash and opens the same form", async () => {
    const response = await GET(requestFor("?token_hash=hash123&type=recovery"));

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash123", type: "recovery" });
    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/nueva-contrasena");
  });

  it("sends a spent link back to sign-in rather than to an unusable form", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });

    const response = await GET(requestFor("?code=spent"));

    expect(response.headers.get("location")).toBe(
      "https://plazavolcanes.com/ingresar?error=recuperacion",
    );
  });

  it("sends a link with nothing to verify back to sign-in", async () => {
    const response = await GET(requestFor(""));

    expect(response.headers.get("location")).toBe(
      "https://plazavolcanes.com/ingresar?error=recuperacion",
    );
  });

  it("says so when Supabase is not configured", async () => {
    configured.value = false;

    const response = await GET(requestFor("?code=abc123"));

    expect(response.headers.get("location")).toBe(
      "https://plazavolcanes.com/ingresar?error=configuracion",
    );
  });
});
