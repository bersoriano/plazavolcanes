import { afterEach, describe, expect, it, vi } from "vitest";

import { requireSignedIn } from "@/lib/require-signed-in.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const redirect = vi.hoisted(() => vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

function signedInAs(claims: unknown) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getClaims: vi.fn().mockResolvedValue({ data: claims }) },
  } as never);
}

describe("requireSignedIn", () => {
  it("returns the signed-in user", async () => {
    signedInAs({ claims: { sub: "buyer-1" } });

    await expect(requireSignedIn("/compras")).resolves.toBe("buyer-1");
  });

  it("sends a signed-out visitor to sign in and back again", async () => {
    // Reading "Todavía no tienes pedidos" when the session has simply expired
    // tells a buyer their order history is gone. They get the sign-in page and
    // land back where they were headed.
    signedInAs(null);

    await expect(requireSignedIn("/compras")).rejects.toThrow(
      "NEXT_REDIRECT:/ingresar?continuar=/compras",
    );
  });

  it("hands the destination over in the one shape safeContinuation accepts", async () => {
    // safeContinuation checks the raw value starts with "/" before it decodes,
    // so a percent-encoded path fails closed and the buyer lands on /panel
    // instead of where they were going. The value goes over unencoded, which
    // is also why this takes a bare path and no query string.
    signedInAs(null);

    await expect(requireSignedIn("/compras/41")).rejects.toThrow(
      "NEXT_REDIRECT:/ingresar?continuar=/compras/41",
    );
  });

  it("treats a session without a subject as signed out", async () => {
    signedInAs({ claims: {} });

    await expect(requireSignedIn("/carrito/4")).rejects.toThrow("NEXT_REDIRECT:/ingresar");
  });
});
