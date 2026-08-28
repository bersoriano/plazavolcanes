import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPickupPoint } from "@/lib/queries/checkout.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("fetchPickupPoint", () => {
  it("keeps successful absence distinct from a read failure", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never);

    await expect(fetchPickupPoint(4)).resolves.toBeNull();
  });

  it("fails closed with a Spanish domain error when the RPC read fails", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "connection reset" },
      }),
    } as never);

    await expect(fetchPickupPoint(4)).rejects.toThrow(
      "No pudimos consultar el punto de recolección.",
    );
  });

  it("fails closed when a non-null RPC payload is malformed", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: { address_line1: "Calle sin localidad" },
        error: null,
      }),
    } as never);

    await expect(fetchPickupPoint(4)).rejects.toThrow(
      "No pudimos consultar el punto de recolección.",
    );
  });
});
