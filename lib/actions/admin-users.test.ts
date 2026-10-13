import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  deleteObjects: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("@/lib/media/store", () => ({ deleteObjects: mocks.deleteObjects }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { deleteUser, setUserDisabled } = await import("@/lib/actions/admin-users");

const idle = { status: "idle" as const, message: "" };
const userId = "10000000-0000-4000-8000-000000000001";

function formOf(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

/** Answers the authorization check, then hands the mutation its own reply. */
function mutationReplies(reply: { data: unknown; error: unknown }) {
  mocks.rpc.mockImplementation((name: string) => {
    if (name === "is_current_user_admin") return Promise.resolve({ data: true, error: null });
    return Promise.resolve(reply);
  });
}

const client = { auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "admin-1" } } });
  mocks.createServerSupabaseClient.mockResolvedValue(client);
});

describe("setUserDisabled", () => {
  beforeEach(() => {
    mutationReplies({
      data: [
        {
          user_id: userId,
          is_disabled: true,
          shop_slugs: ["casa-niebla"],
          product_slugs: ["taza", "plato"],
        },
      ],
      error: null,
    });
  });

  it.each([
    { user_id: "not-a-uuid", disabled: "true" },
    { user_id: userId, disabled: "on" },
  ])("rejects malformed input %j before contacting Supabase", async (entries) => {
    const state = await setUserDisabled(idle, formOf(entries));

    expect(state).toMatchObject({ status: "error", message: "Datos de cuenta inválidos." });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated server claim", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    const state = await setUserDisabled(idle, formOf({ user_id: userId, disabled: "true" }));

    expect(state.message).toBe("Tu sesión terminó. Ingresa nuevamente.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an authenticated person who is not an administrator", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });

    const state = await setUserDisabled(idle, formOf({ user_id: userId, disabled: "true" }));

    expect(state.message).toBe("No tienes permiso para administrar cuentas.");
    expect(mocks.rpc).not.toHaveBeenCalledWith("set_user_disabled", expect.anything());
  });

  it("disables the exact account and revalidates every page that lost a listing", async () => {
    const state = await setUserDisabled(idle, formOf({ user_id: userId, disabled: "true" }));

    expect(mocks.rpc).toHaveBeenLastCalledWith("set_user_disabled", {
      p_user_id: userId,
      p_disabled: true,
    });
    expect(state).toEqual({
      status: "success",
      message: "Cuenta deshabilitada.",
      values: { disabled: "true" },
    });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/",
      "/admin/usuarios",
      "/sitemap.xml",
      "/tiendas/casa-niebla",
      "/productos/taza",
      "/productos/plato",
    ]);
  });

  it("enables the exact account", async () => {
    mutationReplies({
      data: [{ user_id: userId, is_disabled: false, shop_slugs: [], product_slugs: [] }],
      error: null,
    });

    const state = await setUserDisabled(idle, formOf({ user_id: userId, disabled: "false" }));

    expect(mocks.rpc).toHaveBeenLastCalledWith("set_user_disabled", {
      p_user_id: userId,
      p_disabled: false,
    });
    expect(state).toEqual({
      status: "success",
      message: "Cuenta habilitada.",
      values: { disabled: "false" },
    });
  });

  it("explains a refusal to act on the viewer or another administrator", async () => {
    mutationReplies({ data: null, error: { code: "22023", message: "internal wording" } });

    const state = await setUserDisabled(idle, formOf({ user_id: userId, disabled: "true" }));

    expect(state).toMatchObject({
      status: "error",
      message: "No puedes deshabilitar tu propia cuenta ni la de otra persona administradora.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not leak an unexpected database error", async () => {
    mutationReplies({ data: null, error: { code: "XX000", message: "private table leak" } });

    const state = await setUserDisabled(idle, formOf({ user_id: userId, disabled: "true" }));

    expect(state.message).toBe("No pudimos actualizar la cuenta.");
  });
});

describe("deleteUser", () => {
  beforeEach(() => {
    mutationReplies({
      data: [
        {
          user_id: userId,
          shop_slugs: ["casa-niebla"],
          product_slugs: ["taza"],
          image_keys: ["shops/a/logo.webp", "products/a/1/b.webp"],
        },
      ],
      error: null,
    });
  });

  it("rejects a malformed account id before contacting Supabase", async () => {
    const state = await deleteUser(idle, formOf({ user_id: "1; drop table" }));

    expect(state).toMatchObject({ status: "error", message: "Datos de cuenta inválidos." });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated server claim", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    const state = await deleteUser(idle, formOf({ user_id: userId }));

    expect(state.message).toBe("Tu sesión terminó. Ingresa nuevamente.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an authenticated person who is not an administrator", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });

    const state = await deleteUser(idle, formOf({ user_id: userId }));

    expect(state.message).toBe("No tienes permiso para administrar cuentas.");
    expect(mocks.rpc).not.toHaveBeenCalledWith("admin_delete_user", expect.anything());
  });

  it("deletes the exact account, clears its images, and revalidates its pages", async () => {
    const state = await deleteUser(idle, formOf({ user_id: userId }));

    expect(mocks.rpc).toHaveBeenLastCalledWith("admin_delete_user", { p_user_id: userId });
    expect(mocks.deleteObjects).toHaveBeenCalledWith(client, [
      "shops/a/logo.webp",
      "products/a/1/b.webp",
    ]);
    expect(state).toEqual({ status: "success", message: "Cuenta eliminada." });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/",
      "/admin/usuarios",
      "/sitemap.xml",
      "/tiendas/casa-niebla",
      "/productos/taza",
    ]);
  });

  it("tells the administrator to disable an account that has history", async () => {
    mutationReplies({ data: null, error: { code: "23503", message: "internal wording" } });

    const state = await deleteUser(idle, formOf({ user_id: userId }));

    expect(state).toMatchObject({
      status: "error",
      message:
        "Esta cuenta tiene historial de pedidos o conversaciones. Deshabilítala en lugar de eliminarla.",
    });
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("explains a refusal to act on the viewer or another administrator", async () => {
    mutationReplies({ data: null, error: { code: "22023", message: "internal wording" } });

    const state = await deleteUser(idle, formOf({ user_id: userId }));

    expect(state.message).toBe(
      "No puedes eliminar tu propia cuenta ni la de otra persona administradora.",
    );
  });

  it("does not leak an unexpected database error", async () => {
    mutationReplies({ data: null, error: { code: "XX000", message: "private table leak" } });

    const state = await deleteUser(idle, formOf({ user_id: userId }));

    expect(state.message).toBe("No pudimos eliminar la cuenta.");
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
  });
});
