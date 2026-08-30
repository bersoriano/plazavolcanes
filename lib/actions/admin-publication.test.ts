import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { setShopPublishingApproval } = await import("@/lib/actions/admin-publication");

const idle = { status: "idle" as const, message: "" };

function formOf(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "admin-1" } } });
  mocks.rpc.mockImplementation((name: string) => {
    if (name === "is_current_user_admin") return Promise.resolve({ data: true, error: null });
    return Promise.resolve({
      data: [{ shop_id: 7, shop_slug: "casa-niebla", product_slugs: ["taza", "plato"] }],
      error: null,
    });
  });
  mocks.createServerSupabaseClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
  });
});

describe("setShopPublishingApproval", () => {
  it("rejects malformed shop and boolean values before contacting Supabase", async () => {
    const state = await setShopPublishingApproval(
      idle,
      formOf({ shop_id: "07", enabled: "on" }),
    );

    expect(state).toMatchObject({
      status: "error",
      message: "Datos de aprobación inválidos.",
    });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated server claim", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    const state = await setShopPublishingApproval(
      idle,
      formOf({ shop_id: "7", enabled: "true" }),
    );

    expect(state.message).toBe("Tu sesión terminó. Ingresa nuevamente.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an authenticated person who is no longer an administrator", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });

    const state = await setShopPublishingApproval(
      idle,
      formOf({ shop_id: "7", enabled: "true" }),
    );

    expect(state.message).toBe("No tienes permiso para administrar publicaciones.");
    expect(mocks.rpc).toHaveBeenCalledWith("is_current_user_admin");
  });

  it("calls the approval RPC with exact arguments and does not leak its error", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "is_current_user_admin") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: { message: "internal table name" } });
    });

    const state = await setShopPublishingApproval(
      idle,
      formOf({ shop_id: "7", enabled: "false" }),
    );

    expect(mocks.rpc).toHaveBeenLastCalledWith("set_shop_publishing_approval", {
      p_shop_id: 7,
      p_enabled: false,
    });
    expect(state.message).toBe("No pudimos actualizar la aprobación de publicaciones.");
  });

  it("revalidates the public, administrative, shop, product, sitemap, and seller routes", async () => {
    const state = await setShopPublishingApproval(
      idle,
      formOf({ shop_id: "7", enabled: "true" }),
    );

    expect(state).toEqual({ status: "success", message: "Publicaciones habilitadas." });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(7);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/usuarios");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/tiendas/casa-niebla");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos/taza");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/productos/plato");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/panel/tiendas/7");
  });
});
