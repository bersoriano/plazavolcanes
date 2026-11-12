import { beforeEach, expect, test, vi } from "vitest";

const rpc = vi.fn();
const getClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc, auth: { getClaims } }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { sendMessage, sendProductQuestion, startPreSaleConversation } = await import("@/lib/actions/messages");

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

test("sends a product question with the browser's retry key", async () => {
  rpc.mockResolvedValueOnce({ data: 42, error: null });
  const form = formOf("  ¿Está liberado?  ");
  form.set("idempotency_key", "d73b15da-f853-4cfd-ab76-407bafc3846a");
  const state = await sendProductQuestion(3, 12, idle, form);
  expect(state).toMatchObject({ status: "success", conversationId: 42 });
  expect(rpc).toHaveBeenCalledOnce();
  expect(rpc).toHaveBeenCalledWith("send_product_question", {
    p_shop_id: 3, p_product_id: 12, p_body: "¿Está liberado?", p_idempotency_key: "d73b15da-f853-4cfd-ab76-407bafc3846a",
  });
});

test("does not claim a question was sent when delivery fails", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "private error" } });
  const form = formOf("¿Qué salud tiene la batería?");
  form.set("idempotency_key", "d73b15da-f853-4cfd-ab76-407bafc3846a");
  const state = await sendProductQuestion(3, 12, idle, form);
  expect(state).toMatchObject({ status: "error", message: "No pudimos enviar tu pregunta. Inténtalo de nuevo." });
  expect(state.conversationId).toBeUndefined();
});

test("keeps questions working before the atomic database function is deployed", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Function missing" } });
  rpc.mockResolvedValueOnce({ data: 42, error: null });
  rpc.mockResolvedValueOnce({ data: 91, error: null });
  const form = formOf("¿Puedo revisarlo antes de pagar?");
  form.set("idempotency_key", "d73b15da-f853-4cfd-ab76-407bafc3846a");

  expect(await sendProductQuestion(3, 12, idle, form)).toMatchObject({ status: "success", conversationId: 42 });
  expect(rpc).toHaveBeenNthCalledWith(3, "send_conversation_message", {
    p_conversation_id: 42,
    p_body: "¿Puedo revisarlo antes de pagar?",
    p_idempotency_key: "d73b15da-f853-4cfd-ab76-407bafc3846a",
  });
});

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

test("asks for the shop's general enquiry when no product is named", async () => {
  rpc.mockResolvedValue({ data: 42, error: null });

  await startPreSaleConversation(3);

  expect(rpc).toHaveBeenCalledWith("start_pre_sale_conversation", {
    p_shop_id: 3,
    p_product_id: null,
  });
});

test("names the product a thread is about", async () => {
  rpc.mockResolvedValue({ data: 43, error: null });

  await startPreSaleConversation(3, 12);

  expect(rpc).toHaveBeenCalledWith("start_pre_sale_conversation", {
    p_shop_id: 3,
    p_product_id: 12,
  });
});

test("passes a rejected product back in the person's own words", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "Producto no encontrado." } });

  await expect(startPreSaleConversation(3, 12)).resolves.toEqual({
    error: "Producto no encontrado.",
  });
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
