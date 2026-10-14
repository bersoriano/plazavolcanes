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

const { markContactMessageAttended, submitContactMessage } = await import("@/lib/actions/contact");

const idle = { status: "idle" as const, message: "" };
const messageId = "30000000-0000-4000-8000-000000000003";
const received = "Recibimos tu mensaje. Te responderemos por correo o teléfono.";

function formOf(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

const visitor = {
  name: " Luis Pérez ",
  email: "luis@correo.test",
  phone: "55 8765 4321",
  message: " No llegó mi pedido. ",
  website: "",
};

const client = { auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.getClaims.mockResolvedValue({ data: null });
  mocks.createServerSupabaseClient.mockResolvedValue(client);
  mocks.rpc.mockResolvedValue({ data: messageId, error: null });
});

describe("submitContactMessage", () => {
  it("stores what a visitor typed, trimmed, with the phone in its stored form", async () => {
    const state = await submitContactMessage(idle, formOf(visitor));

    expect(mocks.rpc).toHaveBeenCalledWith("submit_contact_message", {
      p_message: "No llegó mi pedido.",
      p_name: "Luis Pérez",
      p_email: "luis@correo.test",
      p_phone: "+525587654321",
    });
    expect(state).toEqual({ status: "success", message: received });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/contacto");
  });

  it("marks each field a visitor got wrong, without contacting the database", async () => {
    const state = await submitContactMessage(
      idle,
      formOf({ ...visitor, name: "", email: "sin-arroba", phone: "123", message: "Hola" }),
    );

    expect(state).toMatchObject({
      status: "error",
      message: "Revisa los campos marcados.",
      errors: {
        name: ["Escribe tu nombre."],
        email: ["Escribe un correo válido."],
        phone: ["Escribe tu teléfono móvil a 10 dígitos."],
        message: ["Escribe un mensaje de entre 10 y 2000 caracteres."],
      },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("asks a signed-in person for the message alone", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });

    const state = await submitContactMessage(idle, formOf({ message: "El vendedor no responde." }));

    expect(mocks.rpc).toHaveBeenCalledWith("submit_contact_message", {
      p_message: "El vendedor no responde.",
      p_name: null,
      p_email: null,
      p_phone: null,
    });
    expect(state.status).toBe("success");
  });

  it("holds a signed-in person to the message length", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });

    const state = await submitContactMessage(idle, formOf({ message: "Hola" }));

    expect(state).toMatchObject({
      status: "error",
      errors: { message: ["Escribe un mensaje de entre 10 y 2000 caracteres."] },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("tells a bot what it wants to hear and stores nothing", async () => {
    const state = await submitContactMessage(idle, formOf({ ...visitor, website: "https://spam.test" }));

    expect(state).toEqual({ status: "success", message: received });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says so when too many messages arrived this hour", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "x" } });

    const state = await submitContactMessage(idle, formOf(visitor));

    expect(state).toMatchObject({
      status: "error",
      message: "Recibimos demasiados mensajes. Intenta de nuevo en un rato.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    [{ data: null, error: { code: "XX000", message: "boom" } }],
    [{ data: null, error: null }],
  ])("does not claim a message was received when the database answers %j", async (reply) => {
    mocks.rpc.mockResolvedValue(reply);

    const state = await submitContactMessage(idle, formOf(visitor));

    expect(state).toMatchObject({
      status: "error",
      message: "No pudimos enviar tu mensaje. Intenta de nuevo.",
    });
  });

  it("does not claim a message was received when nothing is configured", async () => {
    mocks.configured.mockReturnValue(false);

    const state = await submitContactMessage(idle, formOf(visitor));

    expect(state.message).toBe("No pudimos enviar tu mensaje. Intenta de nuevo.");
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });
});

describe("markContactMessageAttended", () => {
  function replies(reply: { data: unknown; error: unknown }, admin = true) {
    mocks.rpc.mockImplementation((name: string) =>
      Promise.resolve(name === "is_current_user_admin" ? { data: admin, error: null } : reply),
    );
  }

  beforeEach(() => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "admin-1" } } });
    replies({ data: null, error: null });
  });

  it("marks the message and refreshes the list", async () => {
    const state = await markContactMessageAttended(idle, formOf({ message_id: messageId }));

    expect(mocks.rpc).toHaveBeenCalledWith("mark_contact_message_attended", {
      p_message_id: messageId,
    });
    expect(state).toEqual({ status: "success", message: "Mensaje atendido." });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/contacto");
  });

  it("rejects a malformed id before contacting Supabase", async () => {
    const state = await markContactMessageAttended(idle, formOf({ message_id: "not-a-uuid" }));

    expect(state).toMatchObject({ status: "error", message: "Mensaje inválido." });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated server claim", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    const state = await markContactMessageAttended(idle, formOf({ message_id: messageId }));

    expect(state.message).toBe("Tu sesión terminó. Ingresa nuevamente.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a person who is not an administrator", async () => {
    replies({ data: null, error: null }, false);

    const state = await markContactMessageAttended(idle, formOf({ message_id: messageId }));

    expect(state.message).toBe("No tienes permiso para atender mensajes.");
    expect(mocks.rpc).not.toHaveBeenCalledWith("mark_contact_message_attended", expect.anything());
  });

  it("says so when the message is not there", async () => {
    replies({ data: null, error: { code: "P0002", message: "x" } });

    const state = await markContactMessageAttended(idle, formOf({ message_id: messageId }));

    expect(state).toMatchObject({ status: "error", message: "No encontramos ese mensaje." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not claim success when the database refuses", async () => {
    replies({ data: null, error: { code: "XX000", message: "boom" } });

    const state = await markContactMessageAttended(idle, formOf({ message_id: messageId }));

    expect(state).toMatchObject({ status: "error", message: "No pudimos marcar el mensaje." });
  });
});
