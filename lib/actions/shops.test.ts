import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  uniqueShopSlug: vi.fn(),
  pickupPointFrom: vi.fn(),
  savePickupPoint: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("@/lib/slug", () => ({ uniqueShopSlug: mocks.uniqueShopSlug }));
vi.mock("@/lib/actions/shop-pickup-point", () => ({
  pickupPointFrom: mocks.pickupPointFrom,
  pickupValidationError: vi.fn(),
  savePickupPoint: mocks.savePickupPoint,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { createShop, updateDeliveryPolicy } = await import("@/lib/actions/shops");

function validShopForm() {
  const formData = new FormData();
  formData.set("name", "Casa Niebla");
  formData.set(
    "description",
    "Objetos hechos en un taller al pie del volcán.",
  );
  formData.set("country_code", "MX");
  formData.set("administrative_area_codes", "MX-PUE");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "seller-1" } } });
  mocks.uniqueShopSlug.mockResolvedValue("casa-niebla");
  mocks.pickupPointFrom.mockReturnValue({ offered: false, parsed: null });
  mocks.savePickupPoint.mockResolvedValue(null);
  mocks.createServerSupabaseClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
    from: mocks.from,
    storage: { from: vi.fn() },
  });
});

describe("createShop", () => {
  it("returns a clear limit message when database rejects another shop", async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "Alcanzaste el límite de tiendas.",
        details: null,
        hint: null,
      },
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    mocks.from.mockReturnValue({ insert });

    const state = await createShop(
      { status: "idle", message: "" },
      validShopForm(),
    );

    expect(state).toEqual({
      status: "error",
      message: "Alcanzaste el límite de tiendas. Contacta a administración si necesitas otra.",
    });
    expect(mocks.savePickupPoint).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("createShop", () => {
  function insertDouble() {
    const single = vi.fn().mockResolvedValue({ data: { id: 7, slug: "casa-niebla" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    mocks.from.mockReturnValue({ insert });
    return insert;
  }

  it("saves the delivery policy written while creating the shop", async () => {
    const insert = insertDouble();
    const formData = validShopForm();
    formData.set("delivery_policy", "  Entrego en persona los sábados en Cholula.  ");

    await createShop({ status: "idle", message: "" }, formData);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_policy: "Entrego en persona los sábados en Cholula." }),
    );
  });

  it("leaves the delivery policy empty when the seller skips it", async () => {
    const insert = insertDouble();

    await createShop({ status: "idle", message: "" }, validShopForm());

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ delivery_policy: null }));
  });
});

describe("updateDeliveryPolicy", () => {
  function shopDouble(deliveryPolicyUpdatedAt: string | null, updateResult: unknown) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { slug: "casa-niebla", delivery_policy_updated_at: deliveryPolicyUpdatedAt },
    });
    const ownerEq = vi.fn().mockReturnValue({ maybeSingle });
    const idEq = vi.fn().mockReturnValue({ eq: ownerEq });
    const select = vi.fn().mockReturnValue({ eq: idEq });
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(updateResult) }),
    });
    mocks.from.mockReturnValue({ select, update });
    return { select, update };
  }

  function policyForm(policy: string) {
    const formData = new FormData();
    formData.set("delivery_policy", policy);
    return formData;
  }

  it("saves the policy and refreshes the public shop page", async () => {
    const { update } = shopDouble(null, { error: null });

    const state = await updateDeliveryPolicy(4, { status: "idle", message: "" }, policyForm("Entrego los martes."));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_policy: "Entrego los martes." }),
    );
    expect(state).toEqual({
      status: "success",
      message: "Política de entregas actualizada.",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/tiendas/casa-niebla");
  });

  it("never writes the timestamp the trigger owns", async () => {
    const { update } = shopDouble(null, { error: null });

    await updateDeliveryPolicy(4, { status: "idle", message: "" }, policyForm("Entrego los martes."));

    expect(update.mock.calls[0][0]).not.toHaveProperty("delivery_policy_updated_at");
  });

  it("says when the field opens again after the monthly limit refuses a change", async () => {
    shopDouble("2026-08-20T12:00:00.000Z", {
      error: {
        code: "P0001",
        message: "Puedes actualizar la política de entregas una vez al mes.",
        details: null,
        hint: null,
      },
    });

    const state = await updateDeliveryPolicy(4, { status: "idle", message: "" }, policyForm("Otra política."));

    expect(state).toEqual({
      status: "error",
      message:
        "Solo puedes cambiar tu política de entregas una vez al mes. Podrás editarla el 19 de septiembre de 2026.",
    });
  });

  it("rejects a policy longer than the field allows before touching the database", async () => {
    const { update } = shopDouble(null, { error: null });

    const state = await updateDeliveryPolicy(4, { status: "idle", message: "" }, policyForm("a".repeat(1201)));

    expect(state.status).toBe("error");
    expect(state.errors?.delivery_policy?.[0]).toBe(
      "La política de entregas no puede pasar de 1200 caracteres.",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a shop the signed-in seller does not own", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
    });
    const update = vi.fn();
    mocks.from.mockReturnValue({ select, update });

    const state = await updateDeliveryPolicy(4, { status: "idle", message: "" }, policyForm("Entrego los martes."));

    expect(state).toEqual({ status: "error", message: "No encontramos esa tienda." });
    expect(update).not.toHaveBeenCalled();
  });
});
