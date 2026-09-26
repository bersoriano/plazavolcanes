import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home, { generateMetadata } from "@/app/page";
import { getHomeCatalog } from "@/lib/queries/catalog.server";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { hasPublishedProducts } from "@/lib/queries/sitemap.server";

vi.mock("@/lib/queries/catalog.server", () => ({
  getHomeCatalog: vi.fn(),
  getCatalogStateCounts: vi.fn(async () => []),
}));
vi.mock("@/lib/queries/categories.server", () => ({ getProductCategoryTree: vi.fn(async () => []) }));
vi.mock("@/lib/queries/sitemap.server", () => ({ hasPublishedProducts: vi.fn(async () => false) }));

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

  it("keeps the fallback hero when an invalid category still returns products", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(
      catalogResult({ products: [sampleProduct()], invalidCategorySelection: true }),
    );

    render(await Home({ searchParams: Promise.resolve({ categoria: "no-existe" }) }));

    const hero = screen
      .getByRole("heading", {
        name: "Una plaza llena de cosas que no encuentras en cualquier lugar.",
      })
      .closest("section");
    expect(hero).not.toBeNull();
    expect(within(hero!).queryByRole("link", { name: "Explorar productos" })).not.toBeInTheDocument();
    expect(within(hero!).queryByRole("link", { name: "Abrir mi tienda" })).not.toBeInTheDocument();
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
    imageUrl: null,
    created_at: "2026-08-01T00:00:00.000Z",
    category_id: null,
    currency_code: "MXN",
    shop: {
      name: "Taller Volcán",
      slug: "taller-volcan",
      country_code: "MX",
      administrative_area_codes: ["MX-OAX"],
      trust_tier: "standard" as const,
      is_premium: false,
    },
  };
}

function sampleShop() {
  return {
    administrative_area_codes: ["MX-OAX"],
    country_code: "MX",
    created_at: "2026-08-01T00:00:00.000Z",
    delivery_policy: null,
    delivery_policy_updated_at: null,
    description: "Piezas de barro negro hechas en Oaxaca.",
    id: 3,
    image_path: null,
    imageUrl: null,
    is_publishing_approved: true,
    is_premium: false,
    publishing_reviewed_at: "2026-08-29T00:00:00.000Z",
    listing_limit: 15,
    name: "Taller Volcán",
    owner_id: "00000000-0000-0000-0000-000000000003",
    slug: "taller-volcan",
    time_zone: "America/Mexico_City",
    trust_evaluated_at: null,
    trust_tier: "standard" as const,
    updated_at: "2026-08-01T00:00:00.000Z",
  };
}

describe("Home conversion sections", () => {
  it("keeps the search inside the adaptive hero when a search is active", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(
      catalogResult({ products: [sampleProduct()] }),
    );

    render(await Home({ searchParams: Promise.resolve({ q: "taza" }) }));

    expect(screen.queryByRole("region", { name: "Buscar en la plaza" })).not.toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("keeps the single adaptive hero on a search", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(
      catalogResult({ products: [sampleProduct()] }),
    );

    render(await Home({ searchParams: Promise.resolve({ q: "taza" }) }));

    expect(
      screen.queryByRole("region", { name: "Vende lo tuyo. Quédate con todo." }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Una plaza llena de cosas que no encuentras en cualquier lugar.",
      }),
    ).toBeInTheDocument();
  });

  it("leaves the open seat out of a search", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(
      catalogResult({ products: [sampleProduct()], shops: [sampleShop()] }),
    );

    render(await Home({ searchParams: Promise.resolve({ q: "taza" }) }));

    expect(screen.queryByText("Tu tienda podría estar aquí")).not.toBeInTheDocument();
  });


  it("offers the landing from the cold start block behind the fallback hero", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(
      catalogResult({ invalidCategorySelection: true }),
    );

    render(await Home({ searchParams: Promise.resolve({ categoria: "no-existe" }) }));

    expect(
      screen.getAllByRole("link", { name: "Quiero vender" }).map((link) => link.getAttribute("href")),
    ).toContain("/vender?desde=vacio");
  });

  it("hides the marketing sections while a catalog search is active", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(
      catalogResult({ products: [sampleProduct()] }),
    );

    render(await Home({ searchParams: Promise.resolve({ q: "taza" }) }));

    expect(
      screen.queryByRole("region", { name: "Antes de acordar una compra" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Vende en Plaza Volcanes." })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Sin retenciones Ni Comisiones" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Plaza Volcanes es una plataforma 100% Mexicana 🇲🇽." }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Cómo comprar en la plaza." }),
    ).not.toBeInTheDocument();
  });
});

const LANDING_H1 = "Vende lo tuyo. Quédate con todo.";

describe("Home landing", () => {
  it("opens the bare home page on the seller hero, with a single h1", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult({ products: [sampleProduct()] }));

    render(await Home({ searchParams: Promise.resolve({}) }));

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(LANDING_H1);
    expect(screen.getByText("Para tiendas independientes de México")).toBeInTheDocument();
  });

  it("sends the hero's two calls to action to signup and to the buyer panel", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult({ products: [sampleProduct()] }));

    render(await Home({ searchParams: Promise.resolve({}) }));

    const hero = screen.getByRole("region", { name: LANDING_H1 });
    expect(within(hero).getByRole("link", { name: "Abrir mi tienda gratis" })).toHaveAttribute(
      "href",
      "/registro?vender=1",
    );
    expect(within(hero).getByRole("link", { name: "Explorar productos" })).toHaveAttribute("href", "#explorar");
  });

  it("names the founders offer without a tally while nothing counts the spots", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult());

    render(await Home({ searchParams: Promise.resolve({}) }));

    const hero = screen.getByRole("region", { name: LANDING_H1 });
    expect(within(hero).getByText("Primeras 100 tiendas")).toBeInTheDocument();
    expect(
      within(hero).getByText(
        "Publican gratis y no pagan comisión por venta si se registran durante los primeros tres meses.",
      ),
    ).toBeInTheDocument();
    expect(within(hero).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("hides the collage from assistive technology and states its facts instead", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult({ products: [sampleProduct()] }));

    render(await Home({ searchParams: Promise.resolve({}) }));

    const receipt = screen.getByText("Pedido confirmado");
    expect(receipt.closest("[aria-hidden='true']")).not.toBeNull();
    expect(
      screen.getByText(/Ejemplo de pedido: precio de venta \$1,999\.00, comisión Plaza Volcanes \$0\.00, retención \$0\.00, tú recibes \$1,999\.00\./),
    ).toHaveTextContent("Recién publicado: Taza de barro negro");
  });

  it("leaves the newest-listing card out while nothing is published", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult());

    render(await Home({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByText("RECIÉN PUBLICADO")).not.toBeInTheDocument();
  });

  it("keeps the catalogue screen for a search", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult({ products: [sampleProduct()] }));

    render(await Home({ searchParams: Promise.resolve({ q: "taza" }) }));

    expect(screen.queryByRole("heading", { level: 1, name: LANDING_H1 })).not.toBeInTheDocument();
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

  it("keeps the fallback hero when an invalid state still returns products", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(catalogResult({ products: [sampleProduct()] }));

    render(await Home({ searchParams: Promise.resolve({ estado: "california" }) }));

    const hero = screen
      .getByRole("heading", {
        name: "Una plaza llena de cosas que no encuentras en cualquier lugar.",
      })
      .closest("section");
    expect(hero).not.toBeNull();
    expect(within(hero!).queryByRole("link", { name: "Explorar productos" })).not.toBeInTheDocument();
    expect(within(hero!).queryByRole("link", { name: "Abrir mi tienda" })).not.toBeInTheDocument();
  });

});

describe("Home search metadata", () => {
  const electronics = {
    id: 1,
    parentId: null,
    slug: "electronica",
    name: "Electrónica",
    sortOrder: 1,
    isActive: true,
    children: [{ id: 11, parentId: 1, slug: "celulares", name: "Celulares", sortOrder: 1, isActive: true }],
  };
  const emptyCatalog = {
    products: [],
    shops: [],
    categories: [],
    selectedCategory: null,
    selectedSubcategory: null,
    invalidCategorySelection: false,
    searchEventId: null,
  };

  function structuredData() {
    return [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
      JSON.parse(script.textContent ?? ""),
    );
  }

  it("gives the bare home page its canonical and nothing to count", async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({}) });

    expect(metadata.alternates?.canonical).toBe("/");
    expect(hasPublishedProducts).not.toHaveBeenCalled();
  });

  it("indexes a category only once something is published under it", async () => {
    vi.mocked(getProductCategoryTree).mockResolvedValue([electronics]);
    vi.mocked(hasPublishedProducts).mockResolvedValueOnce(true);

    const listed = await generateMetadata({ searchParams: Promise.resolve({ categoria: "electronica" }) });

    expect(hasPublishedProducts).toHaveBeenCalledWith([11]);
    expect(listed.alternates?.canonical).toBe("/?categoria=electronica");
    expect(listed.robots).toBeUndefined();

    const empty = await generateMetadata({
      searchParams: Promise.resolve({ categoria: "electronica", subcategoria: "celulares" }),
    });

    expect(empty.robots).toEqual({ index: false, follow: true });
  });

  it("does not count anything for a search", async () => {
    vi.mocked(getProductCategoryTree).mockResolvedValue([electronics]);

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ q: "funda", categoria: "electronica" }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(hasPublishedProducts).not.toHaveBeenCalled();
  });

  it("describes the site and its publisher on the bare home page", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");
    vi.mocked(getHomeCatalog).mockResolvedValue(emptyCatalog);

    render(await Home({ searchParams: Promise.resolve({}) }));

    expect(structuredData()).toEqual([
      {
        "@context": "https://schema.org",
        "@graph": [
          expect.objectContaining({
            "@type": "WebSite",
            name: "Plaza Volcanes",
            url: "https://plazavolcanes.com/",
            inLanguage: "es-MX",
          }),
          expect.objectContaining({ "@type": "Organization", name: "Plaza Volcanes", url: "https://plazavolcanes.com/" }),
        ],
      },
    ]);
    vi.unstubAllEnvs();
  });

  it("leaves structured data to the bare home page", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(emptyCatalog);

    render(await Home({ searchParams: Promise.resolve({ q: "funda" }) }));

    expect(structuredData()).toEqual([]);
  });
});
