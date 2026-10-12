import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  productsSelect: vi.fn(),
  productImagesSelect: vi.fn(),
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
  // Schema rejection can return before consuming a queued database read.
  mocks.productsSelect.mockReset();
  mocks.productImagesSelect.mockReset();
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
    select: mocks.productImagesSelect,
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
  mocks.productImagesSelect.mockImplementation(() => query({ count: 1, error: null }));
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
  it("never publishes a new listing without a usable uploaded cover", async () => {
    mocks.productImagesSelect.mockImplementationOnce(() => query({ count: 0, error: null }));
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
      message: "Agrega al menos una foto del producto antes de publicar.",
      errors: { images: ["Agrega al menos una foto del producto."] },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects an unverified uploaded cover before writing publication", async () => {
    mocks.productsSelect.mockImplementationOnce(() => query({
      data: { shop_id: 7, image_path: null, status: "draft", slug: "taza-anterior", is_admin_enabled: true },
      error: null,
    }));
    mocks.productImagesSelect.mockReturnValueOnce(query({ count: 0, error: null }));
    const form = sellerForm();
    form.append("image_keys", "products/another-seller/cover.jpg");

    expect(await updateProduct(22, idle, form)).toEqual({ status: "error", message: "No pudimos guardar las imágenes." });
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

    await expect(updateProduct(22, idle, sellerForm({
      description: "", price_mxn: "", condition: "", handling_days: "", units_available: "0",
    }))).resolves.toMatchObject({ status: "success" });
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

    expect(state).toEqual({
      status: "success",
      message: "Tu producto ya está publicado.",
      values: { public_url: "http://localhost:3000/productos/taza-volcanica" },
    });
  });

  it("returns the next practical requirement after a draft is saved", async () => {
    mocks.productImagesSelect.mockImplementationOnce(() => query({ count: 0, error: null }));
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

    const state = await updateProduct(22, idle, sellerForm({
      status: "draft", description: "", price_mxn: "", condition: "", category_id: "", handling_days: "", units_available: "",
    }));

    expect(state).toEqual({
      status: "success",
      message: "Borrador guardado",
      values: { next_requirement: "Agrega al menos una foto del producto." },
    });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "draft", description: null, price_mxn: null, condition: null,
      category_id: null, handling_days: null, units_available: null,
    }));
  });
});

describe("setProductStatus", () => {
  it.each([
    [true, true, "Producto publicado."],
    [false, true, "Producto guardado. Está pendiente de aprobación de administración."],
    [true, false, "Producto guardado. Está deshabilitado por administración."],
  ] as const)(
    "reports gate-aware publication feedback when shop approval is %s and product enablement is %s",
    async (isPublishingApproved, isAdminEnabled, message) => {
      mocks.productsSelect.mockImplementationOnce(() => query({
        data: {
          shop_id: 7,
          name: "Taza volcánica",
          description: "Taza hecha a mano con barro de alta temperatura.",
          price_mxn: 349,
          condition: "new",
          used_condition: null,
          handling_days: 3,
          category_id: 11,
          image_path: "products/seller-1/22/cover.jpg",
          status: "draft",
          slug: "taza-volcanica",
          is_admin_enabled: isAdminEnabled,
          units_available: 1,
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

  it("asks a lapsed listing without a cover for one, since renewing it is a new publication", () => {
    return withProduct({ image_path: null, status: "published", expires_at: "2020-01-01T00:00:00.000Z" }, async () => {
      const state = await setProductStatus(22, "published");

      expect(state).toMatchObject({ status: "error", message: "Agrega una imagen de portada antes de publicar." });
      expect(mocks.update).not.toHaveBeenCalled();
    });
  });

  it("clears a lapsed window when a listing is brought back", () => {
    // A row keeps status "published" until the hourly sweep files it as
    // expired, so for up to an hour the seller sees "Vencido" on a row the
    // column still calls published. Sellers may not write the date themselves
    // (guard_product_administration_enablement), so the row is filed as
    // expired first and then published, which is the change set_product_expiry
    // answers with a fresh 30 days — the same path the sweep's rows take.
    return withProduct({ status: "published", expires_at: "2020-01-01T00:00:00.000Z" }, async () => {
      await setProductStatus(22, "published");

      expect(mocks.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: "expired" }));
      expect(mocks.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: "published" }));
      for (const [payload] of mocks.update.mock.calls) {
        expect(payload).not.toHaveProperty("expires_at");
      }
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published" }),
      );
    });
  });

  it("preserves legacy renewal for expired listings with older incomplete fields", () => {
    return withProduct({
      status: "expired", expires_at: "2020-01-01T00:00:00.000Z",
      description: null, price_mxn: null, condition: null, handling_days: null,
    }, async () => {
      expect(await setProductStatus(22, "published")).toMatchObject({ status: "success" });
      expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "published" }));
    });
  });

  it.each([0, null])("keeps a listing with %s units off the shelf", (units) => {
    return withProduct({ status: "expired", expires_at: "2020-01-01T00:00:00.000Z", units_available: units }, async () => {
      const state = await setProductStatus(22, "published");

      expect(state).toEqual({ status: "error", message: "Agrega unidades antes de publicar." });
      expect(mocks.update).not.toHaveBeenCalled();
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
      units_available: 1,
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

describe.each(["editor", "catalog"] as const)("%s draft publication readiness", (path) => {
  const complete = {
    shop_id: 7,
    name: "Taza volcánica",
    description: "Taza hecha a mano con barro de alta temperatura.",
    price_mxn: 349,
    condition: "new",
    used_condition: null,
    handling_days: 3,
    units_available: 2,
    category_id: 11,
    image_path: "products/seller-1/22/cover.jpg",
    status: "draft",
    slug: "taza-volcanica",
    is_admin_enabled: true,
    expires_at: null,
  };

  function prepare(overrides: Record<string, unknown> = {}) {
    const stored = { ...complete, ...overrides };
    mocks.productsSelect.mockImplementationOnce(() => query({ data: stored, error: null }));
    mocks.update.mockImplementation((payload) => ({
      eq: vi.fn(async () => {
        Object.assign(stored, payload);
        return { error: null };
      }),
    }));
    return stored;
  }

  const publish = (formOverrides: Record<string, string> = {}) => path === "editor"
    ? updateProduct(22, idle, sellerForm(formOverrides))
    : setProductStatus(22, "published");

  it.each([
    ["name", { name: "" }, { name: "" }],
    ["name", { name: "ab" }, { name: "ab" }],
    ["description", { description: null }, { description: "" }],
    ["description", { description: "Muy corta." }, { description: "Muy corta." }],
    ["price_mxn", { price_mxn: null }, { price_mxn: "" }],
    ["price_mxn", { price_mxn: 0 }, { price_mxn: "0" }],
    ["condition", { condition: null }, { condition: "" }],
    ["used_condition", { condition: "used", used_condition: null }, { condition: "used", used_condition: "" }],
    ["handling_days", { handling_days: null }, { handling_days: "" }],
    ["units_available", { units_available: null }, { units_available: "" }],
    ["units_available", { units_available: 0 }, { units_available: "0" }],
    ["category_id", { category_id: null }, { category_id: "" }],
    ["images", { image_path: null }, {}],
  ] as const)("rejects missing or invalid %s before any product write", async (field, storedOverride, formOverride) => {
    const stored = prepare(storedOverride);
    const before = { ...stored };
    if (field === "images") mocks.productImagesSelect.mockReturnValueOnce(query({ count: 0, error: null }));

    const state = await publish(formOverride);

    expect(state.status).toBe("error");
    expect(state.errors?.[field]?.length).toBeGreaterThan(0);
    // Status drives expiry and slot usage in database triggers. No UPDATE
    // means neither trigger runs; every saved draft value survives rejection.
    expect(mocks.update).not.toHaveBeenCalled();
    expect(stored).toEqual(before);
    expect(stored.status).toBe("draft");
    expect(stored.expires_at).toBeNull();
  });

  it.each(["subcategory", "parent"])("rejects an inactive %s before any write", async (inactive) => {
    prepare();
    const originalFrom = mocks.from.getMockImplementation()!;
    const categoryQuery = query({ data: null, error: null });
    if (inactive === "parent") categoryQuery.maybeSingle.mockResolvedValueOnce({ data: { parent_id: 1 }, error: null });
    mocks.from.mockImplementation((table: string) => table === "categories"
      ? { select: () => categoryQuery }
      : originalFrom(table));
    const state = await publish();
    expect(state.status).toBe("error");
    expect(state.errors?.category_id).toBeDefined();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("requires a stored cover even when gallery rows exist", async () => {
    prepare({ image_path: null });
    mocks.productImagesSelect.mockReturnValueOnce(query({ count: 1, error: null }));
    expect(await publish()).toMatchObject({ status: "error", errors: { images: expect.any(Array) } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("explains all missing requirements together", async () => {
    prepare({ description: null, price_mxn: null });
    const state = await publish({ description: "", price_mxn: "" });
    expect(state.errors).toMatchObject({
      description: ["Describe tu producto en al menos 20 caracteres."],
      price_mxn: ["Ponle precio en pesos."],
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([false, true])("publishes a complete draft with shop approval %s", async (approved) => {
    const stored = prepare();
    mocks.shop.mockResolvedValueOnce({ data: { slug: "barro-volcanico", listing_limit: 10, is_publishing_approved: approved }, error: null });
    const state = await publish();
    expect(state.status).toBe("success");
    expect(stored.status).toBe("published");
    expect(state.message).toContain(approved ? "publicado" : "pendiente de aprobación");
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("is_publishing_approved");
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("is_admin_enabled");
  });

  it("keeps capacity enforcement after readiness passes", async () => {
    prepare();
    mocks.shop.mockResolvedValueOnce({ data: { slug: "barro-volcanico", listing_limit: 0, is_publishing_approved: false }, error: null });
    if (path === "catalog") {
      await expect(publish()).rejects.toThrow("NEXT_REDIRECT:/panel/productos/22/editar?limite=alcanzado");
    } else {
      expect(await publish()).toMatchObject({ status: "error", message: "Alcanzaste el límite de publicaciones activas de tu tienda." });
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses publication by another shop owner", async () => {
    prepare();
    mocks.shop.mockResolvedValueOnce({ data: null, error: null });
    if (path === "catalog") await expect(publish()).rejects.toThrow("NEXT_REDIRECT:/panel");
    else expect(await publish()).toMatchObject({ status: "error", message: "No puedes editar este producto." });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

it("reports an administration block instead of pending approval after saving", async () => {
  mocks.productsSelect.mockImplementationOnce(() => query({ data: { shop_id: 7, image_path: "cover.jpg", status: "published", slug: "taza", is_admin_enabled: false }, error: null }));
  const state = await updateProduct(22, idle, sellerForm());
  expect(state.message).toContain("deshabilitado por administración");
  expect(state.message).not.toContain("pendiente");
});

it("reports withdrawn pending products as private drafts", async () => {
  mocks.productsSelect.mockImplementationOnce(() => query({ data: { shop_id: 7, status: "published", slug: "taza", is_admin_enabled: true }, error: null }));
  expect(await setProductStatus(22, "draft")).toMatchObject({ status: "success", message: "Borrador guardado. Tu producto sigue privado." });
});
