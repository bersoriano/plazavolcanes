import { afterEach, describe, expect, it, vi } from "vitest";

import { getOwnedShop } from "@/lib/queries/shops.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

function supabaseReturning(result: unknown, claims: unknown = { claims: { sub: "seller-1" } }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  const client = {
    auth: { getClaims: vi.fn().mockResolvedValue({ data: claims }) },
    from: vi.fn().mockReturnValue(query),
  };
  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never);
  return { client, query };
}

describe("getOwnedShop", () => {
  it("scopes the read to the signed-in owner", async () => {
    // Both routes in the workspace read the shop through here, so the owner
    // filter has to live in this one place. A shop id in the URL must never be
    // enough to open somebody else's panel.
    const { query } = supabaseReturning({ data: { id: 4, name: "Casa Niebla" }, error: null });

    await getOwnedShop(4);

    expect(query.eq).toHaveBeenCalledWith("id", 4);
    expect(query.eq).toHaveBeenCalledWith("owner_id", "seller-1");
  });

  it("returns the shop it found", async () => {
    supabaseReturning({ data: { id: 4, name: "Casa Niebla" }, error: null });

    await expect(getOwnedShop(4)).resolves.toMatchObject({ name: "Casa Niebla" });
  });

  it("returns nothing for a shop the signed-in user does not own", async () => {
    supabaseReturning({ data: null, error: null });

    await expect(getOwnedShop(4)).resolves.toBeNull();
  });

  it("returns nothing when nobody is signed in", async () => {
    // Without a subject there is no owner to compare against; querying with an
    // empty string would be a filter that some row could conceivably match.
    const { client } = supabaseReturning({ data: null, error: null }, null);

    await expect(getOwnedShop(4)).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });
});
