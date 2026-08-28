import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const insertCartItem = vi.fn();
const rpc = vi.fn();
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
  createServerSupabaseClient: async () => ({ auth: { getClaims }, rpc }),
}));
vi.mock("@/lib/cart-insert", () => ({ insertCartItem, databaseMessage: (_m: string, f: string) => f }));
vi.mock("@/lib/purchase-intent.server", () => ({ savePurchaseIntent }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const { addToCart, checkoutCart } = await import("@/lib/actions/cart");

const idle = { status: "idle" as const, message: "" };

/** Runs an action that may redirect, returning its state when it does not. */
async function run(work: Promise<unknown>) {
  try {
    return (await work) as {
      status: string;
      message: string;
      errors?: Record<string, string[] | undefined>;
    } | undefined;
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
  rpc.mockResolvedValue({ data: 77, error: null });
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

describe("checkoutCart fulfillment", () => {
  const idempotencyKey = "10000000-0000-4000-8000-000000000099";

  it("requires the buyer to choose pickup or shipping before checkout", async () => {
    const state = await run(checkoutCart(4, idle, formOf({ idempotency_key: idempotencyKey })));

    expect(state).toEqual({
      status: "error",
      message: "Elige recolección o envío para continuar.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { label: "missing", idempotencyKey: undefined },
    { label: "malformed", idempotencyKey: "not-a-uuid" },
  ])("refuses pickup with a $label idempotency key", async ({ idempotencyKey: postedKey }) => {
    const formData = formOf({ fulfillment_method: "pickup" });
    if (postedKey !== undefined) formData.set("idempotency_key", postedKey);

    const state = await run(checkoutCart(4, idle, formData));

    expect(state?.message).toBe("Revisa los campos marcados.");
    expect(state?.errors?.idempotency_key).toEqual(["Falta la clave de confirmación."]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { label: "blank", posted: "   ", expected: null },
    { label: "padded", posted: "  Nos vemos en la entrada.  ", expected: "Nos vemos en la entrada." },
  ])("sends a normalized $label pickup note", async ({ posted, expected }) => {
    await run(checkoutCart(4, idle, formOf({
      fulfillment_method: "pickup",
      idempotency_key: idempotencyKey,
      buyer_note: posted,
    })));

    expect(rpc).toHaveBeenCalledWith(
      "checkout_cart_v3",
      expect.objectContaining({ p_buyer_note: expected }),
    );
  });

  it("refuses an oversized pickup note", async () => {
    const state = await run(checkoutCart(4, idle, formOf({
      fulfillment_method: "pickup",
      idempotency_key: idempotencyKey,
      buyer_note: "x".repeat(1001),
    })));

    expect(state?.message).toBe("Revisa los campos marcados.");
    expect(state?.errors?.buyer_note).toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("checks out pickup through v3 without carrying a shipping address", async () => {
    await run(checkoutCart(4, idle, formOf({
      fulfillment_method: "pickup",
      idempotency_key: idempotencyKey,
      buyer_note: "Entrego identificación.",
      alt_contact_name: "Luis",
      alt_contact_phone: "3312345678",
      alt_contact_note: "Mi hermano",
      recipient: "Esta dirección no pertenece a recolección",
    })));

    expect(rpc).toHaveBeenCalledWith("checkout_cart_v3", {
      p_shop_id: 4,
      p_fulfillment_method: "pickup",
      p_address: null,
      p_alt_contact: {
        name: "Luis",
        phone: "+523312345678",
        note: "Mi hermano",
      },
      p_buyer_note: "Entrego identificación.",
      p_idempotency_key: idempotencyKey,
    });
    expect(redirect).toHaveBeenCalledWith("/compras/77?creado=1");
  });

  it("refuses shipping until its address is valid", async () => {
    const state = await run(checkoutCart(4, idle, formOf({
      fulfillment_method: "shipping",
      idempotency_key: idempotencyKey,
      recipient: "Ana Ruiz",
      address_line1: "Calle Volcán 12",
      locality: "",
      administrative_area: "Jalisco",
      postal_code: "44100",
      country_code: "MX",
    })));

    expect(state?.message).toBe("Revisa los campos marcados.");
    expect(state?.errors?.locality).toEqual(["Escribe la ciudad o localidad."]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends a validated shipping address through v3", async () => {
    await run(checkoutCart(4, idle, formOf({
      fulfillment_method: "shipping",
      idempotency_key: idempotencyKey,
      recipient: " Ana Ruiz ",
      address_line1: " Calle Volcán 12 ",
      address_line2: "",
      locality: " Guadalajara ",
      administrative_area: " Jalisco ",
      postal_code: " 44100 ",
      country_code: "MX",
      delivery_instructions: "",
      buyer_note: "  Tocar el timbre.  ",
    })));

    expect(rpc).toHaveBeenCalledWith("checkout_cart_v3", {
      p_shop_id: 4,
      p_fulfillment_method: "shipping",
      p_address: {
        recipient: "Ana Ruiz",
        address_line1: "Calle Volcán 12",
        address_line2: null,
        locality: "Guadalajara",
        administrative_area: "Jalisco",
        postal_code: "44100",
        country_code: "MX",
        delivery_instructions: null,
      },
      p_alt_contact: null,
      p_buyer_note: "Tocar el timbre.",
      p_idempotency_key: idempotencyKey,
    });
  });
});
