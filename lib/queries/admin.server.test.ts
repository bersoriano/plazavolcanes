import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminMarketplaceRpcRow, AdminMarketplaceUser } from "@/lib/queries/admin";
import { mapAdminMarketplaceUsers } from "@/lib/queries/admin";
import { getAdminMarketplaceUsers } from "@/lib/queries/admin.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/queries/admin", () => ({
  mapAdminMarketplaceUsers: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

const row = {
  user_id: "user-1",
  email: "elena@example.com",
  user_created_at: "2026-08-01T00:00:00.000Z",
  display_name: "Elena",
  shop_limit: 2,
  shop_id: 7,
  shop_name: "Casa Niebla",
  shop_slug: "casa-niebla",
  shop_created_at: "2026-08-02T00:00:00.000Z",
  shop_is_publishing_approved: true,
  product_id: 9,
  product_name: "Taza de barro negro",
  product_slug: "taza-de-barro-negro",
  product_status: "published",
  product_is_admin_enabled: true,
  product_expires_at: "2027-08-03T00:00:00.000Z",
  product_created_at: "2026-08-03T00:00:00.000Z",
  product_updated_at: "2026-08-04T00:00:00.000Z",
} as AdminMarketplaceRpcRow;

const grouped: AdminMarketplaceUser[] = [{
  id: "user-1",
  email: "elena@example.com",
  displayName: "Elena",
  createdAt: "2026-08-01T00:00:00.000Z",
  shopLimit: 2,
  shops: [],
}];

afterEach(() => {
  vi.clearAllMocks();
});

describe("getAdminMarketplaceUsers", () => {
  it("returns grouped RPC data", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ rpc } as never);
    vi.mocked(mapAdminMarketplaceUsers).mockReturnValue(grouped);

    await expect(getAdminMarketplaceUsers()).resolves.toEqual(grouped);
    expect(rpc).toHaveBeenCalledWith("list_admin_marketplace_users");
    expect(mapAdminMarketplaceUsers).toHaveBeenCalledWith([row]);
  });

  it("throws instead of rendering a query failure as an empty list", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ rpc } as never);

    await expect(getAdminMarketplaceUsers()).rejects.toThrow(
      "No pudimos consultar los usuarios de la plataforma.",
    );
  });

  it("returns an empty list without creating a client when Supabase is unconfigured", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);

    await expect(getAdminMarketplaceUsers()).resolves.toEqual([]);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
