import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProductPage from "@/app/productos/[id]/page";
import PublicShopPage from "@/app/tiendas/[slug]/page";
import {
  getPublicProduct,
  getPublicShop,
} from "@/lib/queries/catalog.server";
import { getProductCategoryTree } from "@/lib/queries/categories.server";

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
    vi.mocked(getPublicProduct).mockResolvedValue({
      id: 8,
      name: "Volcanic clay mug",
      description: "Handmade with high-temperature regional clay.",
      price_mxn: 349,
      currency_code: "MXN",
      category_id: null,
      condition: "new",
      used_condition: null,
      image_path: null,
      created_at: "2026-08-19T00:00:00.000Z",
      shop: { name: "Casa Niebla", slug: "casa-niebla" },
    });

    render(
      await ProductPage({
        params: Promise.resolve({ id: "8" }),
        searchParams: Promise.resolve({ locale: "en-US" }),
      }),
    );

    expect(getPublicProduct).toHaveBeenCalledWith(8, "en-US");
    expect(screen.getByRole("heading", { name: "Volcanic clay mug" })).toBeInTheDocument();
    expect(screen.getByText("Handmade with high-temperature regional clay.")).toBeInTheDocument();
  });

  it("renders sharing controls on a public shop", async () => {
    vi.mocked(getPublicShop).mockResolvedValue({
      id: 3,
      owner_id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Casa Niebla",
      slug: "casa-niebla",
      description: "Objetos hechos en un taller al pie del volcán.",
      image_path: null,
      imageUrl: null,
      country_code: "MX",
      administrative_area_code: "MX-JAL",
      created_at: "2026-08-19T00:00:00.000Z",
      updated_at: "2026-08-19T00:00:00.000Z",
      products: [],
    });

    render(await PublicShopPage({ params: Promise.resolve({ slug: "casa-niebla" }) }));

    expect(screen.getByRole("group", { name: "Compartir tienda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compartir" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compartir por WhatsApp" })).toBeInTheDocument();
  });
});
