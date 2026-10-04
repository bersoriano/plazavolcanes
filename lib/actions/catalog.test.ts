import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionState } from "@/lib/action-state";

type Result = { data?: unknown; error?: unknown };
type Recorded = { table: string; calls: unknown[][] };

const state = vi.hoisted(() => ({
  userId: "seller-1" as string | null,
  answer: (() => ({ data: null })) as (query: { table: string; calls: unknown[][] }) => { data?: unknown; error?: unknown },
  queries: [] as { table: string; calls: unknown[][] }[],
}));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/listing-publication.server", () => ({
  isPublishableCategory: vi.fn(async (_client: unknown, categoryId: number | null) => categoryId === 11),
  isListingLimitDatabaseError: (error: { message?: string } | null) => error?.message?.includes("Límite de publicaciones alcanzado") ?? false,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getClaims: async () => ({ data: state.userId ? { claims: { sub: state.userId } } : null }) },
    from: (table: string) => {
      const query: Recorded = { table, calls: [] };
      state.queries.push(query);
      const proxy: Record<string, unknown> = new Proxy({}, {
        get(_target, property) {
          if (property === "then") {
            return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null, ...state.answer(query) }).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            query.calls.push([String(property), ...args]);
            return proxy;
          };
        },
      });
      return proxy;
    },
  }),
}));

const { revalidatePath } = await import("next/cache");
const { reactivateExpiredListings, setProductUnits } = await import("@/lib/actions/catalog");

const idle: ActionState = { status: "idle", message: "" };
const has = (query: Recorded, method: string) => query.calls.some(([name]) => name === method);
const updates = () => state.queries.filter((query) => query.table === "products" && has(query, "update"));

function answerWith(routes: { shop?: Result; product?: Result; listings?: Result; update?: Result }) {
  state.answer = (query) => {
    if (query.table === "shops") return routes.shop ?? { data: null };
    if (has(query, "update")) return routes.update ?? { error: null };
    if (has(query, "maybeSingle")) return routes.product ?? { data: null };
    return routes.listings ?? { data: [] };
  };
}

function units(value: string) {
  const data = new FormData();
  data.set("units_available", value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.userId = "seller-1";
  state.queries = [];
});

describe("setProductUnits", () => {
  const listing = { data: { shop_id: 6, slug: "florero", status: "published" } };
  const shop = { data: { slug: "tienda-de-bear" } };

  it("saves the units a seller has now and refreshes where they show", async () => {
    answerWith({ product: listing, shop });

    const result = await setProductUnits(8, idle, units("40"));

    expect(result).toMatchObject({ status: "success", message: "Guardado" });
    const [update] = updates();
    expect(update.calls).toContainEqual(["update", expect.objectContaining({ units_available: 40 })]);
    expect(update.calls).toContainEqual(["eq", "id", 8]);
    expect(state.queries.find((query) => query.table === "shops")?.calls).toContainEqual(["eq", "owner_id", "seller-1"]);
    for (const path of ["/panel/tiendas/6", "/productos/florero", "/tiendas/tienda-de-bear"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("accepts zero, which marks the listing sold out", async () => {
    answerWith({ product: listing, shop });

    await expect(setProductUnits(8, idle, units("0"))).resolves.toMatchObject({ status: "success" });
  });

  it.each(["1000", "-1", "2.5", "", "muchas"])("refuses %j without touching the listing", async (value) => {
    answerWith({ product: listing, shop });

    const result = await setProductUnits(8, idle, units(value));

    expect(result.status).toBe("error");
    expect(updates()).toHaveLength(0);
  });

  it("refuses a listing in someone else's shop", async () => {
    answerWith({ product: listing, shop: { data: null } });

    await expect(setProductUnits(8, idle, units("3"))).resolves.toEqual({ status: "error", message: "No puedes editar este producto." });
    expect(updates()).toHaveLength(0);
  });

  it("refuses a listing that was deleted", async () => {
    answerWith({ product: { data: { ...listing.data, status: "deleted" } }, shop });

    await expect(setProductUnits(8, idle, units("3"))).resolves.toEqual({ status: "error", message: "Este producto ya no existe." });
    expect(updates()).toHaveLength(0);
  });

  it("asks a signed-out seller to sign in again", async () => {
    state.userId = null;

    await expect(setProductUnits(8, idle, units("3"))).resolves.toEqual({ status: "error", message: "Tu sesión terminó. Ingresa nuevamente." });
  });
});

describe("reactivateExpiredListings", () => {
  const PAST = "2020-01-01T00:00:00.000Z";
  const FUTURE = "2099-01-01T00:00:00.000Z";
  const shop = { data: { id: 6, slug: "tienda-de-bear", listing_limit: 3, is_publishing_approved: true, publishing_reviewed_at: PAST } };

  function row(overrides: Record<string, unknown>) {
    return {
      id: 1,
      name: "Florero",
      slug: "florero",
      status: "expired",
      image_path: "seller/florero.webp",
      units_available: 2,
      category_id: 11,
      expires_at: PAST,
      is_admin_enabled: true,
      updated_at: "2026-09-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("brings back what passes, within the free slots, and names what stays down", async () => {
    answerWith({
      shop,
      listings: {
        data: [
          row({ id: 1, name: "Florero", updated_at: "2026-09-05T00:00:00.000Z" }),
          row({ id: 2, name: "Jarra", units_available: 0 }),
          row({ id: 3, name: "Taza", updated_at: "2026-09-04T00:00:00.000Z" }),
          row({ id: 4, name: "Vaso", updated_at: "2026-09-03T00:00:00.000Z" }),
          row({ id: 5, name: "Activo", status: "published", expires_at: FUTURE }),
        ],
      },
    });

    const result = await reactivateExpiredListings(6);

    // Limit 3 with one live listing leaves two slots: the two most recently edited.
    expect(result).toEqual({
      status: "success",
      message: "Reactivamos 2 productos. No reactivamos: Vaso (límite de publicaciones), Jarra (sin unidades).",
    });
    const [update] = updates();
    expect(update.calls).toContainEqual(["update", expect.objectContaining({ status: "published", expires_at: null })]);
    expect(update.calls).toContainEqual(["in", "id", [1, 3]]);
    expect(update.calls).toContainEqual(["eq", "shop_id", 6]);
    expect(revalidatePath).toHaveBeenCalledWith("/panel/tiendas/6");
    expect(revalidatePath).toHaveBeenCalledWith("/productos/florero");
  });

  it("renews a lapsed listing still marked published without spending a slot", async () => {
    answerWith({
      shop: { data: { ...shop.data, listing_limit: 1 } },
      listings: { data: [row({ id: 7, name: "Lapsado", status: "published", expires_at: PAST })] },
    });

    const result = await reactivateExpiredListings(6);

    expect(result).toEqual({ status: "success", message: "Reactivamos 1 producto." });
    expect(updates()[0].calls).toContainEqual(["in", "id", [7]]);
  });

  it("leaves blocked listings to administration", async () => {
    answerWith({ shop, listings: { data: [row({ id: 8, status: "published", expires_at: FUTURE, is_admin_enabled: false })] } });

    await expect(reactivateExpiredListings(6)).resolves.toEqual({ status: "success", message: "No hay productos vencidos." });
    expect(updates()).toHaveLength(0);
  });

  it("refuses a shop that is not the seller's", async () => {
    answerWith({ shop: { data: null }, listings: { data: [row({})] } });

    await expect(reactivateExpiredListings(6)).resolves.toEqual({ status: "error", message: "No puedes editar esta tienda." });
    expect(updates()).toHaveLength(0);
  });

  it("explains a listing limit the database enforced", async () => {
    answerWith({ shop, listings: { data: [row({})] }, update: { error: { message: "Límite de publicaciones alcanzado." } } });

    await expect(reactivateExpiredListings(6)).resolves.toEqual({
      status: "error",
      message: "Alcanzaste el límite de publicaciones activas de tu tienda.",
    });
  });
});
