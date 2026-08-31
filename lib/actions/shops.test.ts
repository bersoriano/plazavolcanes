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

const { createShop } = await import("@/lib/actions/shops");

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
