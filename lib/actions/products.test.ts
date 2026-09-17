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
  it("refuses to publish a draft without a stored cover image", async () => {
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

    expect(state).toEqual({
      status: "error",
      message: "Agrega una imagen de portada antes de publicar.",
      errors: { images: ["Agrega una imagen de portada antes de publicar."] },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("keeps a legacy published listing editable when it has no gallery cover", async () => {
    mocks.productsSelect.mockImplementationOnce(() => query({
      data: {
        shop_id: 7,
        image_path: null,
        status: "published",
        slug: "taza-anterior",
        is_admin_enabled: true,
      },
      error: null,
    }));

    await expect(updateProduct(22, idle, sellerForm())).resolves.toMatchObject({ status: "success" });
    expect(mocks.update).toHaveBeenCalled();
  });

  it("keeps forged moderation fields out of the seller update and explains pending publication", async () => {
    const existing = query({
      data: {
        shop_id: 7,
        image_path: "products/seller-1/22/cover.jpg",
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
        image_path: "products/seller-1/22/cover.jpg",
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
          image_path: "products/seller-1/22/cover.jpg",
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

  it("keeps a legacy published listing renewable when it has no gallery cover", () => {
    return withProduct({ image_path: null, status: "published", expires_at: "2020-01-01T00:00:00.000Z" }, async () => {
      await setProductStatus(22, "published");

      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published", expires_at: null }),
      );
    });
  });

  it("clears a lapsed window when a listing is brought back", () => {
    // A row keeps status "published" until the hourly sweep files it as
    // expired, so for up to an hour the seller sees "Vencido" on a row the
    // column still calls published. Writing the same status back would leave
    // the stale date in place and the trigger would grant no new window, so
    // the listing would come back already expired. Nulling the date is what
    // asks the trigger for a fresh 30 days, exactly as reactivating a row the
    // sweep already touched does.
    return withProduct({ status: "published", expires_at: "2020-01-01T00:00:00.000Z" }, async () => {
      await setProductStatus(22, "published");

      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published", expires_at: null }),
      );
    });
  });

  it("leaves a live window alone when a listing is unpublished", () => {
    return withProduct({ status: "published", expires_at: "2099-01-01T00:00:00.000Z" }, async () => {
      await setProductStatus(22, "draft");

      expect(mocks.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ expires_at: expect.anything() }),
      );
    });
  });

  it("leaves a live window alone when nothing has lapsed", () => {
    return withProduct({ status: "published", expires_at: "2099-01-01T00:00:00.000Z" }, async () => {
      await setProductStatus(22, "published");

      expect(mocks.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ expires_at: expect.anything() }),
      );
    });
  });
});

async function withProduct(
  overrides: Record<string, unknown>,
  assert: () => Promise<void>,
) {
  mocks.productsSelect.mockImplementationOnce(() => query({
    data: {
      shop_id: 7,
      category_id: 11,
      image_path: "products/seller-1/22/cover.jpg",
      slug: "taza-volcanica",
      is_admin_enabled: true,
      ...overrides,
    },
    error: null,
  }));
  mocks.shop.mockResolvedValueOnce({
    data: { slug: "barro-volcanico", listing_limit: 10, is_publishing_approved: true },
    error: null,
  });

  await assert();
}
