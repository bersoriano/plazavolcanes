import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const insertCartItem = vi.fn();
const savePurchaseIntent = vi.fn();
// The real redirect() throws, which is what stops a Server Action mid-flight.
// A mock that returns instead would let the code below it run and hide that.
const redirect = vi.hoisted(() =>
  vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
);
const configured = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => configured.value }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getClaims } }),
}));
vi.mock("@/lib/cart-insert", () => ({ insertCartItem, databaseMessage: (_m: string, f: string) => f }));
vi.mock("@/lib/purchase-intent.server", () => ({ savePurchaseIntent }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const { addToCart } = await import("@/lib/actions/cart");

const idle = { status: "idle" as const, message: "" };

/** Runs an action that may redirect, returning its state when it does not. */
async function run(work: Promise<unknown>) {
  try {
    return (await work) as { status: string; message: string } | undefined;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT:")) return undefined;
    throw error;
  }
}

function formOf(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  configured.value = true;
  getClaims.mockResolvedValue({ data: { claims: { sub: "buyer-1" } } });
  insertCartItem.mockResolvedValue({ status: "added", shopId: 4 });
});

describe("addToCart while signed out", () => {
  beforeEach(() => {
    getClaims.mockResolvedValue({ data: null });
  });

  it("remembers the product and quantity and asks the person to sign in", async () => {
    await run(addToCart(12, idle, formOf({ quantity: "3", producto: "/productos/taza" })));

    expect(savePurchaseIntent).toHaveBeenCalledWith({
      productId: 12,
      quantity: 3,
      productPath: "/productos/taza",
    });
    expect(redirect).toHaveBeenCalledWith("/ingresar");
  });

  it("never tells a first-time visitor that their session ended", async () => {
    const state = await run(addToCart(12, idle, formOf({ quantity: "1", producto: "/productos/taza" })));

    expect(state?.message ?? "").not.toContain("sesión");
  });

  it("drops a product path that points off the site", async () => {
    await run(addToCart(12, idle, formOf({ quantity: "1", producto: "https://evil.example/x" })));

    expect(savePurchaseIntent).toHaveBeenCalledWith(
      expect.objectContaining({ productPath: null }),
    );
  });

  it("does not reach the cart before there is an account to hold it", async () => {
    await run(addToCart(12, idle, formOf({ quantity: "1" })));

    expect(insertCartItem).not.toHaveBeenCalled();
  });
});

describe("addToCart while signed in", () => {
  it("adds the product and opens that shop's cart", async () => {
    await run(addToCart(12, idle, formOf({ quantity: "2", producto: "/productos/taza" })));

    expect(insertCartItem).toHaveBeenCalledWith(expect.anything(), 12, 2);
    expect(redirect).toHaveBeenCalledWith("/carrito/4");
    expect(savePurchaseIntent).not.toHaveBeenCalled();
  });

  it("explains an unavailable product instead of opening an empty cart", async () => {
    insertCartItem.mockResolvedValue({ status: "unavailable" });

    const state = await run(addToCart(12, idle, formOf({ quantity: "1" })));

    expect(state).toEqual({ status: "error", message: "Este producto ya no está disponible." });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses an impossible quantity before asking the database", async () => {
    const state = await run(addToCart(12, idle, formOf({ quantity: "0" })));

    expect(state?.status).toBe("error");
    expect(state?.message).toBe("Agrega al menos una unidad.");
    expect(insertCartItem).not.toHaveBeenCalled();
  });
});
