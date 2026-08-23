import { beforeEach, expect, test, vi } from "vitest";

const rpc = vi.fn();
const getClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc, auth: { getClaims } }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { sendMessage, startPreSaleConversation } = await import("@/lib/actions/messages");

beforeEach(() => {
  rpc.mockReset();
  getClaims.mockReset();
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
});

function formOf(body: string) {
  const formData = new FormData();
  formData.set("body", body);
  return formData;
}

const idle = { status: "idle" as const, message: "" };

test("generates a fresh idempotency key on every send", async () => {
  rpc.mockResolvedValue({ error: null });

  await sendMessage(7, ["/mensajes/7"], idle, formOf("uno"));
  await sendMessage(7, ["/mensajes/7"], idle, formOf("dos"));

  const firstKey = rpc.mock.calls[0][1].p_idempotency_key;
  const secondKey = rpc.mock.calls[1][1].p_idempotency_key;

  expect(firstKey).not.toBe(secondKey);
});

test("sends the trimmed body to the conversation named", async () => {
  rpc.mockResolvedValue({ error: null });

  await sendMessage(7, ["/mensajes/7"], idle, formOf("  hola  "));

  expect(rpc).toHaveBeenCalledWith(
    "send_conversation_message",
    expect.objectContaining({ p_conversation_id: 7, p_body: "hola" }),
  );
});

test("hands a rate-limit refusal back in the person's own words", async () => {
  rpc.mockResolvedValue({
    error: { code: "P0001", message: "Enviaste demasiados mensajes. Intenta de nuevo en un rato." },
  });

  const state = await sendMessage(7, ["/mensajes/7"], idle, formOf("uno"));

  expect(state.status).toBe("error");
  expect(state.message).toBe("Enviaste demasiados mensajes. Intenta de nuevo en un rato.");
});

test("does not leak an unexpected database error to the reader", async () => {
  rpc.mockResolvedValue({ error: { code: "XX000", message: "deadlock detected on relation 16821" } });

  const state = await sendMessage(7, ["/mensajes/7"], idle, formOf("uno"));

  expect(state.message).toBe("No pudimos enviar el mensaje.");
});

test("keeps what the person typed when a send fails", async () => {
  rpc.mockResolvedValue({ error: { code: "XX000", message: "boom" } });

  const state = await sendMessage(7, ["/mensajes/7"], idle, formOf("uno"));

  expect(state.values?.body).toBe("uno");
});

test("refuses an empty message without calling the database", async () => {
  const state = await sendMessage(7, ["/mensajes/7"], idle, formOf("   "));

  expect(state.status).toBe("error");
  expect(rpc).not.toHaveBeenCalled();
});

test("returns the conversation a shopper just opened", async () => {
  rpc.mockResolvedValue({ data: 42, error: null });

  await expect(startPreSaleConversation(3)).resolves.toEqual({ conversationId: 42 });
});

test("passes an open-thread refusal through in Spanish", async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { code: "P0001", message: "Abriste demasiadas conversaciones hoy. Intenta de nuevo mañana." },
  });

  await expect(startPreSaleConversation(3)).resolves.toEqual({
    error: "Abriste demasiadas conversaciones hoy. Intenta de nuevo mañana.",
  });
});
