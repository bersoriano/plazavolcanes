import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EditProductPage from "@/app/panel/productos/[id]/editar/page";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/queries/categories.server", () => ({ getProductCategoryTree: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/actions/products", () => ({ updateProduct: vi.fn() }));
vi.mock("@/lib/actions/product-translations", () => ({ saveEnglishProductTranslation: vi.fn() }));
vi.mock("@/lib/actions/categories", () => ({ createCategorySuggestion: vi.fn() }));
vi.mock("@/components/products/product-form", () => ({ ProductForm: () => null }));
vi.mock("@/components/products/product-translation-form", () => ({ ProductTranslationForm: () => null }));
vi.mock("@/components/products/category-suggestion-form", () => ({ CategorySuggestionForm: () => null }));

afterEach(cleanup);

function chained(result: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

async function renderEditProduct({
  status = "published",
  expiresAt = null,
  isAdminEnabled = true,
  isPublishingApproved = false,
}: {
  status?: "draft" | "published" | "expired";
  expiresAt?: string | null;
  isAdminEnabled?: boolean;
  isPublishingApproved?: boolean;
} = {}) {
  const productQuery = chained({
    data: {
      id: 9,
      shop_id: 4,
      name: "Taza de barro",
      description: "Taza hecha a mano en barro de alta temperatura.",
      price_mxn: 480,
      image_path: null,
      status,
      expires_at: expiresAt,
      is_admin_enabled: isAdminEnabled,
      slug: "taza-de-barro",
      condition: "new",
      used_condition: null,
      category_id: 1,
      handling_days: 2,
      units_available: 3,
    },
    error: null,
  });
  const galleryQuery = chained({ data: [], error: null });
  const shopQuery = chained({
    data: { id: 4, name: "Casa Niebla", is_publishing_approved: isPublishingApproved },
    error: null,
  });
  const translationQuery = chained({ data: null, error: null });

  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "seller-1" } } }) },
    from: vi.fn((table: string) => {
      if (table === "products") return productQuery;
      if (table === "product_images") return galleryQuery;
      if (table === "shops") return shopQuery;
      return translationQuery;
    }),
  } as never);

  render(await EditProductPage({
    params: Promise.resolve({ id: "9" }),
    searchParams: Promise.resolve({}),
  }));

  return { productQuery, shopQuery };
}

describe("EditProductPage", () => {
  it("does not offer the public link for a seller-published product awaiting shop approval", async () => {
    const { shopQuery } = await renderEditProduct();

    expect(shopQuery.select).toHaveBeenCalledWith("id, name, is_publishing_approved");
    expect(screen.getByText("Esperando aprobación de administración")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver publicación" })).not.toBeInTheDocument();
  });

  it.each([
    [{ status: "draft" }, "Desactivado por ti"],
    [{ isPublishingApproved: false }, "Esperando aprobación de administración"],
    [{ isPublishingApproved: true, isAdminEnabled: false }, "Deshabilitado por administración"],
    [{ status: "expired", isPublishingApproved: true, expiresAt: "2026-08-01T00:00:00.000Z" }, "Vencido"],
  ] as const)("never offers the public link when the listing is %s", async (input, label) => {
    await renderEditProduct(input);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver publicación" })).not.toBeInTheDocument();
  });
});
