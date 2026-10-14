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

const { markPlatformNoticeRead, retractNotice, sendNotice } = await import(
  "@/lib/actions/platform-notices"
);

const idle = { status: "idle" as const, message: "" };
const recipientId = "10000000-0000-4000-8000-000000000001";
const batchId = "20000000-0000-4000-8000-000000000002";

function formOf(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

const direct = {
  audience: "person",
  recipient_id: recipientId,
  title: " Tu tienda necesita portada ",
  body: "Agrega una foto de portada.",
  action_href: "/panel",
  action_label: "Ir a mi panel",
};

const announcement = {
  audience: "everyone",
  title: "Mantenimiento",
  body: "El sábado por la noche.",
  action_href: "",
  action_label: "",
};

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

describe("sendNotice", () => {
  beforeEach(() => {
    mutationReplies({ data: [{ batch_id: batchId, recipient_count: 1 }], error: null });
  });

  it.each([
    [{ ...direct, audience: "vecinos" }],
    [{ ...direct, recipient_id: "not-a-uuid" }],
    [{ ...direct, recipient_id: "" }],
  ])("rejects a malformed destination %j before contacting Supabase", async (entries) => {
    const state = await sendNotice(idle, formOf(entries));

    expect(state).toMatchObject({ status: "error", message: "Datos de aviso inválidos." });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...direct, title: "  " }, "Escribe un título."],
    [{ ...direct, body: "" }, "Escribe un mensaje."],
    [{ ...direct, action_href: "https://evil.test" }, "El enlace debe empezar con / y quedarse dentro de la plaza."],
    [{ ...direct, action_label: "" }, "Escribe el texto del botón."],
  ])("says what is wrong with %j before contacting Supabase", async (entries, message) => {
    const state = await sendNotice(idle, formOf(entries));

    expect(state).toMatchObject({ status: "error", message });
    // What was typed comes back, so nothing has to be written twice.
    expect(state.values?.body).toBe(entries.body);
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated server claim", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    const state = await sendNotice(idle, formOf(direct));

    expect(state.message).toBe("Tu sesión terminó. Ingresa nuevamente.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an authenticated person who is not an administrator", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });

    const state = await sendNotice(idle, formOf(direct));

    expect(state.message).toBe("No tienes permiso para enviar avisos.");
    expect(mocks.rpc).not.toHaveBeenCalledWith("send_platform_notice", expect.anything());
  });

  it("sends a notice to exactly one person, trimmed", async () => {
    const state = await sendNotice(idle, formOf(direct));

    expect(mocks.rpc).toHaveBeenLastCalledWith("send_platform_notice", {
      p_audience: "person",
      p_recipient_id: recipientId,
      p_title: "Tu tienda necesita portada",
      p_body: "Agrega una foto de portada.",
      p_action_href: "/panel",
      p_action_label: "Ir a mi panel",
    });
    expect(state).toEqual({ status: "success", message: "Aviso enviado." });
  });

  it("sends an announcement to an audience and names no person", async () => {
    mutationReplies({ data: [{ batch_id: batchId, recipient_count: 214 }], error: null });

    // A recipient left over in the form must not ride along with an audience.
    const state = await sendNotice(idle, formOf({ ...announcement, recipient_id: recipientId }));

    expect(mocks.rpc).toHaveBeenLastCalledWith("send_platform_notice", {
      p_audience: "everyone",
      p_recipient_id: null,
      p_title: "Mantenimiento",
      p_body: "El sábado por la noche.",
      p_action_href: null,
      p_action_label: null,
    });
    expect(state).toEqual({ status: "success", message: "Anuncio enviado a 214 personas." });
  });

  it("counts one person in the singular", async () => {
    const state = await sendNotice(idle, formOf(announcement));

    expect(state.message).toBe("Anuncio enviado a 1 persona.");
  });

  it("refreshes the history and every inbox it may have reached", async () => {
    await sendNotice(idle, formOf(announcement));

    expect(mocks.revalidatePath.mock.calls).toEqual([["/admin/avisos"], ["/mensajes", "layout"]]);
  });

  it("says when the person is not there", async () => {
    mutationReplies({ data: null, error: { code: "P0002", message: "internal wording" } });

    const state = await sendNotice(idle, formOf(direct));

    expect(state).toMatchObject({ status: "error", message: "No encontramos esa cuenta." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says when an audience has nobody in it", async () => {
    mutationReplies({ data: null, error: { code: "P0002", message: "internal wording" } });

    const state = await sendNotice(idle, formOf(announcement));

    expect(state.message).toBe("No hay personas en esa audiencia.");
  });

  it("never echoes what the database said", async () => {
    mutationReplies({ data: null, error: { code: "XX000", message: "relation private.x leaked" } });

    const state = await sendNotice(idle, formOf(direct));

    expect(state).toMatchObject({ status: "error", message: "No pudimos enviar el aviso." });
    expect(state.values?.title).toBe(direct.title);
  });
});

describe("retractNotice", () => {
  beforeEach(() => mutationReplies({ data: 214, error: null }));

  it("rejects a malformed send before contacting Supabase", async () => {
    const state = await retractNotice(idle, formOf({ batch_id: "not-a-uuid" }));

    expect(state).toMatchObject({ status: "error", message: "Datos de aviso inválidos." });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated server claim", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    const state = await retractNotice(idle, formOf({ batch_id: batchId }));

    expect(state.message).toBe("Tu sesión terminó. Ingresa nuevamente.");
  });

  it("rejects an authenticated person who is not an administrator", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });

    const state = await retractNotice(idle, formOf({ batch_id: batchId }));

    expect(state.message).toBe("No tienes permiso para enviar avisos.");
    expect(mocks.rpc).not.toHaveBeenCalledWith("retract_platform_notice", expect.anything());
  });

  it("retracts the exact send and refreshes what showed it", async () => {
    const state = await retractNotice(idle, formOf({ batch_id: batchId }));

    expect(mocks.rpc).toHaveBeenLastCalledWith("retract_platform_notice", { p_batch_id: batchId });
    expect(state).toEqual({ status: "success", message: "Aviso retirado." });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/admin/avisos"], ["/mensajes", "layout"]]);
  });

  it("treats a send that was already retracted as done", async () => {
    mutationReplies({ data: 0, error: null });

    const state = await retractNotice(idle, formOf({ batch_id: batchId }));

    expect(state.status).toBe("success");
  });

  it("says when the send is not there", async () => {
    mutationReplies({ data: null, error: { code: "P0002", message: "internal wording" } });

    const state = await retractNotice(idle, formOf({ batch_id: batchId }));

    expect(state).toMatchObject({ status: "error", message: "No encontramos ese envío." });
  });

  it("never echoes what the database said", async () => {
    mutationReplies({ data: null, error: { code: "XX000", message: "relation private.x leaked" } });

    const state = await retractNotice(idle, formOf({ batch_id: batchId }));

    expect(state.message).toBe("No pudimos retirar el aviso.");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("markPlatformNoticeRead", () => {
  it("marks the notice through the database, which only ever marks the caller's own", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await markPlatformNoticeRead(12);

    expect(mocks.rpc).toHaveBeenCalledWith("mark_platform_notice_read", { p_notice_id: 12 });
  });

  it("never throws: read state is a convenience", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });

    await expect(markPlatformNoticeRead(12)).resolves.toBeUndefined();
  });
});
