import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProductPage from "@/app/productos/[id]/page";
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
      name: "Taza volcánica",
      description: "Taza hecha a mano con barro de alta temperatura.",
      price_mxn: 349,
      currency_code: "MXN",
      category_id: 11,
      condition: "new",
      used_condition: null,
      image_path: null,
      created_at: "2026-08-19T00:00:00.000Z",
      shop: { name: "Casa Niebla", slug: "casa-niebla" },
    });

    render(
      await ProductPage({
        params: Promise.resolve({ id: "8" }),
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
      name: "Volcanic clay mug",
      description: "Handmade with high-temperature regional clay.",
      price_mxn: 349,
      currency_code: "MXN",
      category_id: 11,
      condition: "new",
      used_condition: null,
      image_path: null,
      created_at: "2026-08-19T00:00:00.000Z",
      shop: { name: "Casa Niebla", slug: "casa-niebla" },
    });

    render(
      await ProductPage({
        params: Promise.resolve({ id: "8" }),
        searchParams: Promise.resolve({ locale: "en-US", countryCode: "US" }),
      }),
    );

    expect(getPublicProduct).toHaveBeenCalledWith(8, "en-US");
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
      name: "Casa Niebla",
      slug: "casa-niebla",
      description: "Objetos hechos en un taller al pie del volcán.",
      image_path: null,
      imageUrl: null,
      listing_limit: 15,
      time_zone: "America/Mexico_City",
      trust_evaluated_at: null,
      trust_tier: "standard",
      country_code: "MX",
      administrative_area_code: "MX-JAL",
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
    expect(screen.getByText("Vendedor establecido")).toBeInTheDocument();
    expect(screen.getAllByText("Sin verificar")).toHaveLength(2);
    expect(screen.getByText("Nivel Estándar")).toBeInTheDocument();
    expect(
      screen.getByText(
        "La antigüedad muestra cuánto tiempo lleva este vendedor activo en Plaza Volcanes y ayuda a evaluar su trayectoria.",
      ),
    ).toHaveAttribute("role", "tooltip");
    expect(
      screen.getByText(
        "Este vendedor aún no completa la verificación de identidad. Recomendamos tomar precauciones adicionales.",
      ),
    ).toHaveAttribute("role", "tooltip");
  });
});
