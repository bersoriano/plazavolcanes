import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import { getHomeCatalog } from "@/lib/queries/catalog.server";

vi.mock("@/lib/queries/catalog.server", () => ({
  getHomeCatalog: vi.fn(),
  getCatalogStateCounts: vi.fn(async () => []),
}));

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn() }));

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

function catalogResult(
  overrides: Partial<Awaited<ReturnType<typeof getHomeCatalog>>> = {},
) {
  return {
    products: [],
    shops: [],
    categories: [],
    selectedCategory: null,
    selectedSubcategory: null,
    invalidCategorySelection: false,
    searchEventId: null,
    ...overrides,
  } as Awaited<ReturnType<typeof getHomeCatalog>>;
}

function sampleProduct() {
  return {
    id: 7,
    slug: "taza-de-barro-negro",
    units_available: 2,
    name: "Taza de barro negro",
    description: "Pieza hecha a mano en Oaxaca.",
    price_mxn: 480,
    condition: "new" as const,
    used_condition: null,
    image_path: null,
    created_at: "2026-08-01T00:00:00.000Z",
    category_id: null,
    currency_code: "MXN",
    shop: { name: "Taller Volcán", slug: "taller-volcan" },
  };
}

describe("Home conversion sections", () => {
  it("shows the buyer trust strip, the seller pitch and the buying steps when products exist", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(
      catalogResult({ products: [sampleProduct()] }),
    );

    render(await Home({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("region", { name: "Compra con respaldo" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Vende en Plaza Volcanes" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Cómo comprar en la plaza" })).toBeInTheDocument();
  });

  it("renders every trust tier with its free listing limit so sellers see what they unlock", async () => {
    const { getTrustTierMarker } = await import("@/lib/trust-tiers");
    vi.mocked(getHomeCatalog).mockResolvedValue(
      catalogResult({ products: [sampleProduct()] }),
    );

    render(await Home({ searchParams: Promise.resolve({}) }));

    const pitch = screen.getByRole("region", { name: "Vende en Plaza Volcanes" });
    for (const tier of ["standard", "reliable", "top_rated"] as const) {
      const marker = getTrustTierMarker(tier);
      expect(within(pitch).getByText(marker.label)).toBeInTheDocument();
      expect(
        within(pitch).getByText(`${marker.listingLimit} productos publicados`),
      ).toBeInTheDocument();
    }
  });

  it("sends the seller call to action to registration", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(
      catalogResult({ products: [sampleProduct()] }),
    );

    render(await Home({ searchParams: Promise.resolve({}) }));

    const pitch = screen.getByRole("region", { name: "Vende en Plaza Volcanes" });
    expect(within(pitch).getByRole("link", { name: "Abrir mi tienda" })).toHaveAttribute(
      "href",
      "/registro",
    );
  });

  it("moves the seller pitch above the catalog while no product has been published", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult());

    render(await Home({ searchParams: Promise.resolve({}) }));

    const pitch = screen.getByRole("region", { name: "Vende en Plaza Volcanes" });
    const catalog = screen.getByRole("region", { name: "Descubrimientos de la plaza" });
    const relation = pitch.compareDocumentPosition(catalog);

    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the catalog heading and its empty state in the cold start layout", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult());

    render(await Home({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Descubrimientos de la plaza" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Aún no hay productos publicados" }),
    ).toBeInTheDocument();
  });

  it("hides the marketing sections while a catalog search is active", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(
      catalogResult({ products: [sampleProduct()] }),
    );

    render(await Home({ searchParams: Promise.resolve({ q: "taza" }) }));

    expect(screen.queryByRole("region", { name: "Compra con respaldo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Vende en Plaza Volcanes" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Cómo comprar en la plaza" }),
    ).not.toBeInTheDocument();
  });
});

describe("Home state parameter", () => {
  it("redirects a state query parameter to its canonical path", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult());

    await Home({ searchParams: Promise.resolve({ estado: "jalisco" }) });

    expect(redirect).toHaveBeenCalledWith("/estado/jalisco");
  });

  it("carries a search along when redirecting to the state path", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult());

    await Home({
      searchParams: Promise.resolve({ estado: "jalisco", q: "taza", categoria: "electronica" }),
    });

    expect(redirect).toHaveBeenCalledWith("/estado/jalisco?q=taza&categoria=electronica");
  });

  it("keeps the national catalog and warns when the state is unknown", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult());

    render(await Home({ searchParams: Promise.resolve({ estado: "california" }) }));

    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Estado no disponible. Mostramos todo México.",
    );
  });

  it("offers the state explorer on the national catalog", async () => {
    const { getCatalogStateCounts } = await import("@/lib/queries/catalog.server");
    vi.mocked(getCatalogStateCounts).mockResolvedValue([{ code: "MX-JAL", count: 3 }]);
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult({ products: [sampleProduct()] }));

    render(await Home({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("region", { name: "Explora por estado" })).toBeInTheDocument();
  });
});
