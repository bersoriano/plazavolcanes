import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import { getHomeCatalog } from "@/lib/queries/catalog.server";

vi.mock("@/lib/queries/catalog.server", () => ({
  getHomeCatalog: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Home category fallback", () => {
  it("resets an unknown leaf under a valid root without keeping the root heading", async () => {
    const selectedCategory = {
      id: 1,
      parentId: null,
      slug: "electronica",
      name: "Electrónica",
      sortOrder: 1,
      isActive: true,
      children: [
        {
          id: 11,
          parentId: 1,
          slug: "computacion",
          name: "Computación",
          sortOrder: 1,
          isActive: true,
        },
      ],
    };
    vi.mocked(getHomeCatalog).mockResolvedValue({
      products: [],
      shops: [],
      categories: [selectedCategory],
      selectedCategory,
      selectedSubcategory: null,
      invalidCategorySelection: true,
      searchEventId: null,
    });

    render(
      await Home({
        searchParams: Promise.resolve({
          categoria: "electronica",
          subcategoria: "no-existe",
        }),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Categoría no disponible. Mostramos todos los productos.",
    );
    const navigation = screen.getByRole("navigation", { name: "Categorías de productos" });
    expect(within(navigation).getByRole("link", { name: "Todos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(navigation).getByRole("link", { name: "Todos" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("heading", { name: "Descubrimientos de la plaza" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Productos de Electrónica" })).not.toBeInTheDocument();
  });

  it("preserves locale and country when clearing filters from an empty catalog", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue({
      products: [],
      shops: [],
      categories: [],
      selectedCategory: null,
      selectedSubcategory: null,
      invalidCategorySelection: false,
      searchEventId: null,
    });

    render(
      await Home({
        searchParams: Promise.resolve({
          q: "camera",
          locale: "en-US",
          countryCode: "US",
        }),
      }),
    );

    expect(screen.getByDisplayValue("en-US")).toHaveAttribute("name", "locale");
    expect(screen.getByDisplayValue("US")).toHaveAttribute("name", "countryCode");
    for (const link of screen.getAllByRole("link", { name: "Limpiar filtros" })) {
      expect(link).toHaveAttribute("href", "/?locale=en-US&countryCode=US");
    }
  });

  it("passes malformed category state through so the fallback notice remains visible", async () => {
    vi.mocked(getHomeCatalog).mockImplementation(async (filters) => ({
      products: [],
      shops: [],
      categories: [],
      selectedCategory: null,
      selectedSubcategory: null,
      invalidCategorySelection:
        typeof filters === "object" && filters.invalidCategorySelection,
      searchEventId: null,
    }));

    render(
      await Home({
        searchParams: Promise.resolve({ categoria: "INVALID SLUG" }),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Categoría no disponible. Mostramos todos los productos.",
    );
  });
});
