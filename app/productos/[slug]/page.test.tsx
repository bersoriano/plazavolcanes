import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPublicProduct = vi.fn();

vi.mock("@/lib/queries/catalog.server", () => ({ getPublicProduct }));
vi.mock("@/lib/queries/categories.server", () => ({ getProductCategoryTree: async () => [] }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => false }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/actions/cart", () => ({ addToCart: vi.fn() }));
vi.mock("@/lib/actions/start-conversation", () => ({ openConversation: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));

const { default: ProductPage } = await import("@/app/productos/[slug]/page");

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

function renderPage(searchParams: Record<string, string> = {}) {
  return ProductPage({
    params: Promise.resolve({ slug: "taza-de-barro" }),
    searchParams: Promise.resolve(searchParams),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getPublicProduct.mockResolvedValue(product);
});

afterEach(cleanup);

describe("Product page purchase notices", () => {
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
