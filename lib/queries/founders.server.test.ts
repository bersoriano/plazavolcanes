import { afterEach, describe, expect, it, vi } from "vitest";

import { FOUNDERS_FALLBACK } from "@/lib/launch";
import { getFoundersProgram, viewerIsFounder } from "@/lib/queries/founders.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

function supabaseWith(rpc: (name: string) => unknown, sub: string | null = "seller-1", founderShops = 0) {
  const query = { select: vi.fn(), eq: vi.fn(), not: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.not.mockResolvedValue({ count: founderShops });
  const client = {
    auth: { getClaims: vi.fn().mockResolvedValue({ data: sub ? { claims: { sub } } : null }) },
    rpc: vi.fn(async (name: string) => rpc(name)),
    from: vi.fn().mockReturnValue(query),
  };
  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never);
  return client;
}

describe("getFoundersProgram", () => {
  it("reads the counter from founders_status", async () => {
    supabaseWith(() => ({ data: [{ cap: 100, taken: 38, min_live_items: 8, qualify_days: 7, is_open: true }], error: null }));

    await expect(getFoundersProgram()).resolves.toEqual({ open: true, taken: 38, cap: 100 });
  });

  it("closes the offer when the database says the window is over or full", async () => {
    supabaseWith(() => ({ data: [{ cap: 100, taken: 100, min_live_items: 8, qualify_days: 7, is_open: false }], error: null }));

    await expect(getFoundersProgram()).resolves.toEqual({ open: false, taken: 100, cap: 100 });
  });

  it("keeps the offer up without a number before the migration exists", async () => {
    supabaseWith(() => ({ data: null, error: { code: "PGRST202", message: "not found" } }));

    await expect(getFoundersProgram()).resolves.toEqual(FOUNDERS_FALLBACK);
  });
});

describe("viewerIsFounder", () => {
  it("asks only for a signed-in visitor", async () => {
    const client = supabaseWith(() => ({ data: null, error: null }), null, 1);

    await expect(viewerIsFounder()).resolves.toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("reports an owner whose shop holds a seat", async () => {
    supabaseWith(() => ({ data: null, error: null }), "seller-1", 1);
    await expect(viewerIsFounder()).resolves.toBe(true);

    supabaseWith(() => ({ data: null, error: null }), "seller-1", 0);
    await expect(viewerIsFounder()).resolves.toBe(false);
  });
});
