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
  exchangeCodeForSession.mockResolvedValue({ error: null });
  verifyOtp.mockResolvedValue({ error: null });
  resumePurchaseIntent.mockResolvedValue(null);
});

describe("GET /auth/confirm", () => {
  it("sends a confirmed account to the panel", async () => {
    const response = await GET(requestFor("?code=abc"));

    expect(response.headers.get("location")).toBe("https://plazavolcanes.com/panel");
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
      "https://plazavolcanes.com/ingresar?error=confirmacion",
    );
  });
});
