import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  productsSelect: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  shop: vi.fn(),
  revalidatePath: vi.fn(),
}));

const redirect = vi.hoisted(() => vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
}));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));

const { createProduct, setProductStatus, updateProduct } = await import("@/lib/actions/products");

const idle = { status: "idle" as const, message: "" };

function formOf(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

function query(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function sellerForm(overrides: Record<string, string> = {}) {
  return formOf({
    name: "Taza volcánica",
    description: "Taza hecha a mano con barro de alta temperatura.",
    price_mxn: "349.00",
    status: "published",
    condition: "new",
    used_condition: "",
    category_id: "11",
    handling_days: "3",
    units_available: "2",
    currency_code: "MXN",
    content_locale: "es-MX",
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "seller-1" } } });

  const slugCheck = query({ data: null, error: null });
  const listingCount = query({ count: 0, error: null });
  const categoryQuery = query({ data: { parent_id: 1 }, error: null });
  categoryQuery.maybeSingle
    .mockResolvedValueOnce({ data: { parent_id: 1 }, error: null })
    .mockResolvedValueOnce({ data: { id: 1 }, error: null });
  const category = { select: vi.fn(() => categoryQuery) };
  const products = {
    select: mocks.productsSelect,
    insert: mocks.insert,
    update: mocks.update,
  };
  const productImages = {
    select: vi.fn(() => query({ count: 0, error: null })),
  };
  const shops = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        })),
      })),
    })),
  };
  mocks.from.mockImplementation((table: string) => {
    if (table === "products") return products;
    if (table === "product_images") return productImages;
    if (table === "shops") return shops;
    if (table === "categories") return category;
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.productsSelect.mockImplementation((_columns: string, options?: { count?: string; head?: boolean }) => (
    options?.head ? listingCount : slugCheck
  ));
  shops.select.mockImplementation(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: mocks.shop })),
    })),
  }));
  mocks.shop.mockResolvedValue({
    data: { slug: "barro-volcanico", listing_limit: 10, is_publishing_approved: false },
    error: null,
  });
  mocks.createServerSupabaseClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
    from: mocks.from,
  });
  mocks.insert.mockReturnValue({
    select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 22 }, error: null }) })),
  });
  mocks.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
});

describe("createProduct", () => {
  it("creates a literal draft without accepting forged publication or moderation values", async () => {
    await expect(createProduct(7, idle, sellerForm({ is_admin_enabled: "false" }))).rejects.toThrow(
      "NEXT_REDIRECT:/panel/productos/22/editar?creado=1",
    );

    expect(mocks.insert).toHaveBeenCalledWith({
      name: "Taza volcánica",
      description: "Taza hecha a mano con barro de alta temperatura.",
      price_mxn: 349,
      condition: "new",
      used_condition: null,
      category_id: 11,
      handling_days: 3,
      units_available: 2,
      currency_code: "MXN",
      content_locale: "es-MX",
      shop_id: 7,
      slug: "taza-volcanica",
      status: "draft",
    });
  });
});

describe("updateProduct", () => {
  it("keeps forged moderation fields out of the seller update and explains pending publication", async () => {
    const existing = query({
      data: {
        shop_id: 7,
        image_path: null,
        status: "draft",
        slug: "taza-anterior",
        is_admin_enabled: true,
      },
      error: null,
    });
    mocks.productsSelect.mockImplementationOnce(() => existing);

    const state = await updateProduct(22, idle, sellerForm({ is_admin_enabled: "false" }));

    expect(mocks.update).toHaveBeenCalledWith({
      name: "Taza volcánica",
      description: "Taza hecha a mano con barro de alta temperatura.",
      price_mxn: 349,
      status: "published",
      condition: "new",
      used_condition: null,
      category_id: 11,
      handling_days: 3,
      units_available: 2,
      currency_code: "MXN",
      content_locale: "es-MX",
      slug: "taza-volcanica",
      updated_at: expect.any(String),
    });
    expect(state).toEqual({
      status: "success",
      message: "Producto guardado. Está pendiente de aprobación de administración.",
    });
  });

  it("reports immediate publication only when the shop and product gates are enabled", async () => {
    mocks.shop.mockResolvedValueOnce({
      data: { slug: "barro-volcanico", listing_limit: 10, is_publishing_approved: true },
      error: null,
    });
    mocks.productsSelect.mockImplementationOnce(() => query({
      data: {
        shop_id: 7,
        image_path: null,
        status: "draft",
        slug: "taza-anterior",
        is_admin_enabled: true,
      },
      error: null,
    }));

    const state = await updateProduct(22, idle, sellerForm());

    expect(state).toEqual({ status: "success", message: "Producto publicado." });
  });
});

describe("setProductStatus", () => {
  it.each([
    [true, true, "Producto publicado."],
    [false, true, "Producto guardado. Está pendiente de aprobación de administración."],
    [true, false, "Producto guardado. Está pendiente de aprobación de administración."],
  ] as const)(
    "reports gate-aware publication feedback when shop approval is %s and product enablement is %s",
    async (isPublishingApproved, isAdminEnabled, message) => {
      mocks.productsSelect.mockImplementationOnce(() => query({
        data: {
          shop_id: 7,
          category_id: 11,
          status: "draft",
          slug: "taza-volcanica",
          is_admin_enabled: isAdminEnabled,
        },
        error: null,
      }));
      mocks.shop.mockResolvedValueOnce({
        data: {
          slug: "barro-volcanico",
          listing_limit: 10,
          is_publishing_approved: isPublishingApproved,
        },
        error: null,
      });

      const state = await setProductStatus(22, "published");

      expect(state).toEqual({ status: "success", message });
    },
  );
});
