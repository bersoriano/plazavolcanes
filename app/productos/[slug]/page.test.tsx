import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPublicProduct = vi.fn();

vi.mock("@/lib/queries/catalog.server", () => ({ getPublicProduct }));
const getProductCategoryTree = vi.fn(async () => [] as unknown[]);
vi.mock("@/lib/queries/categories.server", () => ({ getProductCategoryTree }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => false }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/actions/cart", () => ({ addToCart: vi.fn() }));
vi.mock("@/lib/actions/start-conversation", () => ({ openConversation: vi.fn() }));
// The button is replaced by a stub that hands its props back, so a test can call
// the very action the page bound and see what it was bound to.
vi.mock("@/components/messages/start-conversation-button", () => ({
  StartConversationButton: (props: Record<string, unknown>) => {
    conversationButtonProps = props;
    return null;
  },
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));

const viewer = { ownsShop: false };
vi.mock("@/lib/queries/seller-standing.server", () => ({
  viewerOwnsAnyShop: vi.fn(async () => viewer.ownsShop),
}));

let conversationButtonProps: Record<string, unknown> = {};

const { default: ProductPage, generateMetadata } = await import("@/app/productos/[slug]/page");
const { openConversation } = await import("@/lib/actions/start-conversation");
const { notFound } = await import("next/navigation");

const product = {
  id: 12,
  slug: "taza-de-barro",
  name: "Taza de barro",
  description: "Hecha a mano.",
  price_mxn: 25000,
  units_available: 3,
  condition: "new" as const,
  used_condition: null,
  image_path: null,
  images: [],
  created_at: "2026-08-01T00:00:00.000Z",
  category_id: null,
  currency_code: "MXN",
  shop: { name: "Casa Niebla", slug: "casa-niebla" },
  shopId: 4,
  shopOwnerId: "seller-1",
};

function renderPage(
  searchParams: Record<string, string> = {},
  slug = "taza-de-barro",
) {
  return ProductPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(searchParams),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  viewer.ownsShop = false;
  getPublicProduct.mockResolvedValue(product);
});

afterEach(cleanup);

describe("Product page purchase notices", () => {
  it("treats a moderation-hidden published product as not found", async () => {
    const adminDisabledPublishedProduct = { slug: "taza-deshabilitada", is_admin_enabled: false };
    getPublicProduct.mockResolvedValue(null);
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("not found");
    });

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: adminDisabledPublishedProduct.slug }) }),
    ).resolves.toEqual({ title: "Producto no encontrado" });
    await expect(renderPage({}, adminDisabledPublishedProduct.slug)).rejects.toThrow("not found");

    expect(getPublicProduct).toHaveBeenCalledWith(adminDisabledPublishedProduct.slug, "es-MX");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("tells a returning buyer the product ran out", async () => {
    render(await renderPage({ compra: "agotado" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Este producto ya no está disponible. Busca otro en la plaza.",
    );
  });

  it("tells a returning buyer the request could not be completed", async () => {
    render(await renderPage({ compra: "error" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "No pudimos agregar el producto a tu carrito. Inténtalo de nuevo.",
    );
  });

  it("says nothing to somebody just browsing", async () => {
    render(await renderPage());

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("gives the purchase form its own page to return to", async () => {
    render(await renderPage());

    expect(document.querySelector('input[name="producto"]')).toHaveValue(
      "/productos/taza-de-barro",
    );
  });
});

describe("Product page premium theming", () => {
  it("shows a distinguished shop's product in the premium room", async () => {
    getPublicProduct.mockResolvedValue({
      ...product,
      shop: { ...product.shop, is_premium: true },
    });

    const { container } = render(await renderPage());

    expect(container.querySelector('[data-theme="premium"]')).not.toBeNull();
    expect(screen.getByRole("group", { name: "Tienda Premium" })).toBeInTheDocument();
  });

  it("leaves an ordinary shop's product in the ordinary theme", async () => {
    getPublicProduct.mockResolvedValue({
      ...product,
      shop: { ...product.shop, is_premium: false },
    });

    const { container } = render(await renderPage());

    expect(container.querySelector('[data-theme="premium"]')).toBeNull();
  });
});

describe("Product page messaging", () => {
  it("binds the shop and the product it loaded, not what the browser sends", async () => {
    render(await renderPage());

    const action = conversationButtonProps.action as (
      state: unknown,
      formData: FormData,
    ) => Promise<unknown>;
    const forged = new FormData();
    forged.set("shop_id", "999");
    forged.set("product_id", "999");
    await action({ status: "idle", message: "" }, forged);

    expect(openConversation).toHaveBeenCalledWith(4, 12, null, expect.anything(), forged);
  });

  it("returns a signed-out shopper to the product they asked about", async () => {
    render(await renderPage());

    expect(conversationButtonProps.returnTo).toBe("/productos/taza-de-barro");
  });
});

describe("Product page search metadata", () => {
  function structuredData() {
    const script = document.querySelector('script[type="application/ld+json"]');
    return JSON.parse(script?.textContent ?? "null");
  }

  it("reads the Spanish listing for its metadata, whatever the page was asked in", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "taza-de-barro" }) });

    expect(getPublicProduct).toHaveBeenCalledWith("taza-de-barro", "es-MX");
    expect(metadata.alternates?.canonical).toBe("/productos/taza-de-barro");
    expect(metadata.title).toEqual({ absolute: "Taza de barro (Nuevo) | Plaza Volcanes" });
  });

  it("describes the product, its offer and where it sits in the catalog", async () => {
    getProductCategoryTree.mockResolvedValueOnce([
      {
        id: 1,
        parentId: null,
        slug: "hogar-y-jardin",
        name: "Hogar y jardín",
        sortOrder: 1,
        isActive: true,
        children: [{ id: 11, parentId: 1, slug: "cocina", name: "Cocina", sortOrder: 1, isActive: true }],
      },
    ]);
    getPublicProduct.mockResolvedValue({ ...product, category_id: 11 });

    render(await renderPage());

    const [item, breadcrumb] = structuredData()["@graph"];
    expect(item).toMatchObject({
      "@type": "Product",
      name: "Taza de barro",
      category: "Hogar y jardín > Cocina",
      offers: { price: "25000.00", priceCurrency: "MXN", availability: "https://schema.org/InStock" },
    });
    expect(breadcrumb.itemListElement.map((entry: { name: string }) => entry.name)).toEqual([
      "Plaza Volcanes",
      "Hogar y jardín",
      "Cocina",
      "Taza de barro",
    ]);
  });

  it("invites a shopper without a shop to sell one of their own", async () => {
    render(await renderPage());

    const invitation = screen.getByRole("link", { name: "Véndelo en la plaza" });

    expect(invitation).toHaveAttribute("href", "/vender?desde=producto");
    // A quiet line, not a third button competing with asking and buying.
    expect(invitation.tagName).toBe("A");
    expect(invitation.parentElement).toHaveTextContent("¿Tienes uno igual? Véndelo en la plaza");
  });

  it("says nothing about selling to somebody who already runs a shop", async () => {
    viewer.ownsShop = true;

    render(await renderPage());

    expect(screen.queryByRole("link", { name: "Véndelo en la plaza" })).not.toBeInTheDocument();
    expect(screen.queryByText(/¿Tienes uno igual\?/)).not.toBeInTheDocument();
  });
});
