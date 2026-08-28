import { beforeEach, expect, test, vi } from "vitest";

const startPreSaleConversation = vi.fn();
const redirect = vi.fn();

vi.mock("@/lib/actions/messages", () => ({ startPreSaleConversation }));
vi.mock("next/navigation", () => ({ redirect }));

const { openConversation } = await import("@/lib/actions/start-conversation");

const idle = { status: "idle" as const, message: "" };

beforeEach(() => {
  vi.clearAllMocks();
  startPreSaleConversation.mockResolvedValue({ conversationId: 42 });
});

test("keeps a product page's thread about that product", async () => {
  await openConversation(3, 12, null, idle, new FormData());

  expect(startPreSaleConversation).toHaveBeenCalledWith(3, 12);
  expect(redirect).toHaveBeenCalledWith("/mensajes/42");
});

test("opens the shop's general enquiry when no product is bound", async () => {
  await openConversation(3, null, null, idle, new FormData());

  expect(startPreSaleConversation).toHaveBeenCalledWith(3, null);
});

test("ignores anything the submitted form claims", async () => {
  const formData = new FormData();
  formData.set("product_id", "999");
  formData.set("shop_id", "999");

  await openConversation(3, 12, null, idle, formData);

  expect(startPreSaleConversation).toHaveBeenCalledWith(3, 12);
});

test("hands a refusal back instead of redirecting", async () => {
  startPreSaleConversation.mockResolvedValue({ error: "Producto no encontrado." });

  const state = await openConversation(3, 12, null, idle, new FormData());

  expect(state).toEqual({ status: "error", message: "Producto no encontrado." });
  expect(redirect).not.toHaveBeenCalled();
});

test("returns to the path the cart bound after opening a conversation", async () => {
  await openConversation(3, 12, "/", idle, new FormData());

  expect(redirect).toHaveBeenCalledWith("/");
});
