import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProductPage from "@/app/productos/[slug]/page";
import PublicShopPage from "@/app/tiendas/[slug]/page";
import {
  getPublicProduct,
  getPublicShop,
} from "@/lib/queries/catalog.server";
import { getProductCategoryTree } from "@/lib/queries/categories.server";

vi.mock("@/lib/actions/cart", () => ({
  addToCart: vi.fn(),
}));

vi.mock("@/lib/queries/catalog.server", () => ({
  getPublicProduct: vi.fn(),
  getPublicShop: vi.fn(),
}));

vi.mock("@/lib/queries/categories.server", () => ({
  getProductCategoryTree: vi.fn(),
}));

const notFound = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ notFound, redirect: vi.fn() }));
// Both pages now resolve the viewer, to decide whether to offer the shop a
// message. server-only does not resolve under vitest, so the client is mocked
// rather than the pages being reshaped around the test.
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: null } }) },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("public sharing controls", () => {
  it("renders sharing controls on a published product", async () => {
    vi.mocked(getProductCategoryTree).mockResolvedValue([
      {
        id: 1,
        parentId: null,
        slug: "hogar-y-jardin",
        name: "Hogar y jardín",
        sortOrder: 1,
        isActive: true,
        children: [
          {
            id: 11,
            parentId: 1,
            slug: "cocina-y-comedor",
            name: "Cocina y comedor",
            sortOrder: 1,
            isActive: true,
          },
        ],
      },
    ]);
    vi.mocked(getPublicProduct).mockResolvedValue({
      id: 8,
      slug: "taza-volcanica",
      name: "Taza volcánica",
      description: "Taza hecha a mano con barro de alta temperatura.",
      price_mxn: 349,
      units_available: 1,
      images: [],
      currency_code: "MXN",
      category_id: 11,
      condition: "new",
      used_condition: null,
      image_path: null,
      created_at: "2026-08-19T00:00:00.000Z",
      shop: {
        name: "Casa Niebla",
        slug: "casa-niebla",
        country_code: "MX",
        administrative_area_codes: ["MX-JAL"],
        trust_tier: "standard",
      },
      shopId: 1,
      shopOwnerId: "11111111-1111-4111-8111-111111111111",
    });

    render(
      await ProductPage({
        params: Promise.resolve({ slug: "taza-volcanica" }),
        searchParams: Promise.resolve({
          q: "taza",
          categoria: "hogar-y-jardin",
          subcategoria: "cocina-y-comedor",
        }),
      }),
    );

    expect(screen.getByRole("group", { name: "Compartir producto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compartir" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compartir por WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Categoría del producto" })).toHaveTextContent(
      "Hogar y jardínCocina y comedor",
    );
    expect(screen.getByRole("link", { name: "Volver a resultados" })).toHaveAttribute(
      "href",
      "/?q=taza&categoria=hogar-y-jardin&subcategoria=cocina-y-comedor",
    );
    expect(screen.getByText("MXN")).toBeInTheDocument();
  });

  it("requests and renders approved English product content for an en-US catalog visit", async () => {
    vi.mocked(getProductCategoryTree).mockResolvedValue([
      {
        id: 1,
        parentId: null,
        slug: "home-and-garden",
        name: "Home and garden",
        sortOrder: 1,
        isActive: true,
        children: [
          {
            id: 11,
            parentId: 1,
            slug: "kitchen-and-dining",
            name: "Kitchen and dining",
            sortOrder: 1,
            isActive: true,
          },
        ],
      },
    ]);
    vi.mocked(getPublicProduct).mockResolvedValue({
      id: 8,
      slug: "taza-volcanica",
      name: "Volcanic clay mug",
      description: "Handmade with high-temperature regional clay.",
      price_mxn: 349,
      units_available: 1,
      images: [],
      currency_code: "MXN",
      category_id: 11,
      condition: "new",
      used_condition: null,
      image_path: null,
      created_at: "2026-08-19T00:00:00.000Z",
      shop: {
        name: "Casa Niebla",
        slug: "casa-niebla",
        country_code: "MX",
        administrative_area_codes: ["MX-JAL"],
        trust_tier: "standard",
      },
      shopId: 1,
      shopOwnerId: "11111111-1111-4111-8111-111111111111",
    });

    render(
      await ProductPage({
        params: Promise.resolve({ slug: "taza-volcanica" }),
        searchParams: Promise.resolve({ locale: "en-US", countryCode: "US" }),
      }),
    );

    expect(getPublicProduct).toHaveBeenCalledWith("taza-volcanica", "en-US");
    expect(screen.getByRole("heading", { name: "Volcanic clay mug" })).toBeInTheDocument();
    expect(screen.getByText("Handmade with high-temperature regional clay.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a resultados" })).toHaveAttribute(
      "href",
      "/?locale=en-US&countryCode=US",
    );
    expect(screen.getByRole("link", { name: "Home and garden" })).toHaveAttribute(
      "href",
      "/?categoria=home-and-garden&locale=en-US&countryCode=US",
    );
    expect(screen.getByRole("link", { name: "Kitchen and dining" })).toHaveAttribute(
      "href",
      "/?categoria=home-and-garden&subcategoria=kitchen-and-dining&locale=en-US&countryCode=US",
    );
    expect(screen.getByText("MX$349.00")).toBeInTheDocument();
  });

  it("renders sharing controls on a public shop", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-28T12:00:00.000Z"));
    vi.mocked(getPublicShop).mockResolvedValue({
      id: 3,
      owner_id: "123e4567-e89b-12d3-a456-426614174000",
      seller_display_name: "Vendedor #123E",
      name: "Casa Niebla",
      slug: "casa-niebla",
      description: "Objetos hechos en un taller al pie del volcán.",
      image_path: null,
      imageUrl: null,
      listing_limit: 15,
      time_zone: "America/Mexico_City",
      trust_evaluated_at: null,
      trust_metrics: null,
      trust_tier: "standard",
      country_code: "MX",
      administrative_area_codes: ["MX-JAL"],
      created_at: "2026-08-19T00:00:00.000Z",
      updated_at: "2026-08-19T00:00:00.000Z",
      trust_profile: {
        joined_on: "2024-02-29",
        verification_level: "unverified",
      },
      products: [],
    });

    render(await PublicShopPage({ params: Promise.resolve({ slug: "casa-niebla" }) }));

    expect(screen.getByRole("group", { name: "Compartir tienda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compartir" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compartir por WhatsApp" })).toBeInTheDocument();
    expect(screen.getByText("Miembro desde febrero de 2024")).toBeInTheDocument();
    expect(screen.getByTestId("trust-badge-membership")).toHaveAttribute(
      "title",
      expect.stringContaining("Vendedor establecido"),
    );
    expect(screen.getByText("Nivel Estándar")).toBeInTheDocument();
    // A shop with no evaluation still shows every signal, greyed out.
    expect(screen.getByTestId("trust-badge-response_rate")).toHaveAttribute(
      "data-state",
      "unmeasured",
    );
  });
});

describe("product slug routing", () => {
  it("looks the product up by the slug in the path", async () => {
    vi.mocked(getProductCategoryTree).mockResolvedValue([]);
    vi.mocked(getPublicProduct).mockResolvedValue({
      id: 8,
      slug: "motorola-razr-5g",
      name: "Motorola Razr 5G",
      description: "Teléfono plegable en excelente estado general.",
      price_mxn: 8999,
      units_available: 1,
      images: [],
      currency_code: "MXN",
      category_id: null,
      condition: "used",
      used_condition: "good",
      image_path: null,
      created_at: "2026-08-19T00:00:00.000Z",
      shop: {
        name: "Tecno Plaza",
        slug: "tecno-plaza",
        country_code: "MX",
        administrative_area_codes: ["MX-JAL"],
        trust_tier: "standard",
      },
      shopId: 1,
      shopOwnerId: "11111111-1111-4111-8111-111111111111",
    });

    render(
      await ProductPage({
        params: Promise.resolve({ slug: "motorola-razr-5g" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(vi.mocked(getPublicProduct).mock.calls[0][0]).toBe("motorola-razr-5g");
    expect(screen.getByRole("heading", { level: 1, name: "Motorola Razr 5G" })).toBeInTheDocument();
  });

  it("does not resolve a product from a numeric path", async () => {
    vi.mocked(getProductCategoryTree).mockResolvedValue([]);
    vi.mocked(getPublicProduct).mockResolvedValue(null);

    await ProductPage({
      params: Promise.resolve({ slug: "8" }),
      searchParams: Promise.resolve({}),
    }).catch(() => undefined);

    expect(notFound).toHaveBeenCalled();
  });
});
