import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const upsert = vi.fn();
const from = vi.fn(() => ({ upsert }));
const configured = { value: true };

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getClaims }, from }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => configured.value }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { updateEmailNotifications } = await import("@/lib/actions/notifications");

function form(enabled: boolean) {
  const data = new FormData();
  if (enabled) data.set("email_enabled", "on");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  configured.value = true;
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  upsert.mockResolvedValue({ error: null });
});

describe("updateEmailNotifications", () => {
  it("saves the switch for the signed-in person only", async () => {
    const state = await updateEmailNotifications({ status: "idle", message: "" }, form(false));

    expect(from).toHaveBeenCalledWith("notification_preferences");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", email_enabled: false }),
      { onConflict: "user_id" },
    );
    expect(state).toEqual({ status: "success", message: "Ya no te enviaremos avisos por correo." });
  });

  it("switches emails back on", async () => {
    const state = await updateEmailNotifications({ status: "idle", message: "" }, form(true));

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ email_enabled: true }), { onConflict: "user_id" });
    expect(state.message).toBe("Te avisaremos por correo.");
  });

  it("asks a signed-out person to sign in again", async () => {
    getClaims.mockResolvedValue({ data: null });

    const state = await updateEmailNotifications({ status: "idle", message: "" }, form(true));

    expect(state).toEqual({ status: "error", message: "Tu sesión terminó. Ingresa nuevamente." });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("says when the switch could not be saved", async () => {
    upsert.mockResolvedValue({ error: { message: "boom" } });

    const state = await updateEmailNotifications({ status: "idle", message: "" }, form(true));

    expect(state).toEqual({ status: "error", message: "No pudimos guardar tus avisos." });
  });
});
