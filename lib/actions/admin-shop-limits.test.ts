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

const { setUserShopLimit } = await import("@/lib/actions/admin-publication");

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
    if (name === "is_current_user_admin") {
      return Promise.resolve({ data: true, error: null });
    }
    return Promise.resolve({ data: 4, error: null });
  });
  mocks.createServerSupabaseClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
  });
});

describe("setUserShopLimit", () => {
  it.each(["-1", "01", "1.5", "2147483648", ""])(
    "rejects malformed shop limit %j before contacting Supabase",
    async (shopLimit) => {
      const state = await setUserShopLimit(
        idle,
        formOf({
          user_id: "10000000-0000-4000-8000-000000000001",
          shop_limit: shopLimit,
        }),
      );

      expect(state).toMatchObject({
        status: "error",
        message: "El límite debe ser un número entero entre 0 y 2147483647.",
      });
      expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
    },
  );

  it("requires an authenticated administrator claim", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    const state = await setUserShopLimit(
      idle,
      formOf({
        user_id: "10000000-0000-4000-8000-000000000001",
        shop_limit: "0",
      }),
    );

    expect(state.message).toBe("Tu sesión terminó. Ingresa nuevamente.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an authenticated person who is not an administrator", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });

    const state = await setUserShopLimit(
      idle,
      formOf({
        user_id: "10000000-0000-4000-8000-000000000001",
        shop_limit: "2",
      }),
    );

    expect(state.message).toBe("No tienes permiso para cambiar límites de tiendas.");
  });

  it("updates exact user limit and revalidates admin and seller panels", async () => {
    const state = await setUserShopLimit(
      idle,
      formOf({
        user_id: "10000000-0000-4000-8000-000000000001",
        shop_limit: "4",
      }),
    );

    expect(mocks.rpc).toHaveBeenLastCalledWith("set_user_shop_limit", {
      p_user_id: "10000000-0000-4000-8000-000000000001",
      p_shop_limit: 4,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/usuarios");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/panel");
    expect(state).toEqual({
      status: "success",
      message: "Límite de tiendas actualizado.",
      values: { shop_limit: "4" },
    });
  });

  it("returns a generic message when limit RPC fails", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "is_current_user_admin") {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "private table leak" } });
    });

    const state = await setUserShopLimit(
      idle,
      formOf({
        user_id: "10000000-0000-4000-8000-000000000001",
        shop_limit: "4",
      }),
    );

    expect(state.message).toBe("No pudimos actualizar el límite de tiendas.");
  });
});
