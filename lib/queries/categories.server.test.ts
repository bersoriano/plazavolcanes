import { expect, it, vi } from "vitest";
import { getHomeCatalog } from "@/lib/queries/catalog.server";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

it("stops a category and budget search when the category lookup fails", async () => {
  const failure = { data: null, error: { code: "57014", message: "timeout" } };
  const categoryRead = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    in: () => ({ eq: async () => failure }),
  };
  const rpc = vi.fn();
  vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: () => categoryRead, rpc } as never);
  await expect(getHomeCatalog(normalizeCatalogFilters({ categoria: "moda-y-accesorios", max: "100" })))
    .rejects.toThrow("57014");
  expect(rpc).not.toHaveBeenCalled();
});
