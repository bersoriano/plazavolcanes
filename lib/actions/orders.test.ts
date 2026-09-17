import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getClaims: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc: mocks.rpc, auth: { getClaims: mocks.getClaims } }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { cancelOrderAsSeller, confirmOrderPayment, transitionOrder } = await import("@/lib/actions/orders");

const idle = { status: "idle" as const, message: "" };
const KEY = "5b1c1f7e-3a2d-4c8e-9f10-2b3c4d5e6f70";

function form(fields: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("idempotency_key", KEY);
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "seller-1" } } });
});

describe("seller order actions", () => {
  it.each([
    ["accepting", () => transitionOrder(41, "accept", idle, form())],
    ["rejecting", () => transitionOrder(41, "reject", idle, form())],
    ["marking the hand-over", () => transitionOrder(41, "ship", idle, form({ tracking_text: "GUIA-1" }))],
    ["confirming payment", () => confirmOrderPayment(41, idle, form())],
    ["cancelling", () => cancelOrderAsSeller(41, idle, form({ reason: "inventory_unavailable" }))],
  ])("refreshes the seller's action queue after %s", async (_name, run) => {
    mocks.rpc.mockResolvedValue({ error: null });

    const state = await run();

    expect(state.status).toBe("success");
    // The dashboard queue lives on /panel; the order itself and the list must
    // not keep offering a step that was just taken.
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/panel");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/panel/pedidos/41");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/panel/pedidos");
  });

  it("passes the form's idempotency key through, so a repeated submit is the same request", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await transitionOrder(41, "accept", idle, form());
    await transitionOrder(41, "accept", idle, form());

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "accept_order", { p_order_id: 41, p_idempotency_key: KEY });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "accept_order", { p_order_id: 41, p_idempotency_key: KEY });
  });

  it("reports an order that already moved on in the database's words", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "P0001", message: "El pedido ya no está pendiente." } });

    const state = await transitionOrder(41, "accept", idle, form());

    expect(state).toEqual({ status: "error", message: "El pedido ya no está pendiente." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a submit without its idempotency key before touching the database", async () => {
    const state = await confirmOrderPayment(41, idle, new FormData());

    expect(state.status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
