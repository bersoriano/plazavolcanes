import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProductPage from "@/app/productos/[id]/page";
import PublicShopPage from "@/app/tiendas/[slug]/page";
import {
  getPublicProduct,
  getPublicShop,
} from "@/lib/queries/catalog.server";

vi.mock("@/lib/queries/catalog.server", () => ({
  getPublicProduct: vi.fn(),
  getPublicShop: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("public sharing controls", () => {
  it("renders sharing controls on a published product", async () => {
    vi.mocked(getPublicProduct).mockResolvedValue({
      id: 8,
      name: "Taza volcánica",
      description: "Taza hecha a mano con barro de alta temperatura.",
      price_mxn: 349,
      condition: "new",
      used_condition: null,
      image_path: null,
      created_at: "2026-08-19T00:00:00.000Z",
      shop: { name: "Casa Niebla", slug: "casa-niebla" },
    });

    render(await ProductPage({ params: Promise.resolve({ id: "8" }) }));

    expect(screen.getByRole("group", { name: "Compartir producto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compartir" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compartir por WhatsApp" })).toBeInTheDocument();
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
