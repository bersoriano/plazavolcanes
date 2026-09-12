import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ShopCatalogPage from "@/app/panel/tiendas/[id]/page";
import { getOwnedShop } from "@/lib/queries/shops.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/queries/shops.server", () => ({ getOwnedShop: vi.fn() }));
vi.mock("@/lib/queries/trust.server", () => ({ getShopTrustDashboard: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/actions/products", () => ({ deleteProduct: vi.fn(), setProductStatus: vi.fn() }));

afterEach(cleanup);

const FAR_FUTURE = "2099-01-01T00:00:00.000Z";
const LONG_AGO = "2020-01-01T00:00:00.000Z";

const SHOP = {
  id: 4,
  owner_id: "seller-1",
  name: "Casa Niebla",
  slug: "casa-niebla",
  image_path: null,
  is_publishing_approved: true,
  publishing_reviewed_at: "2026-08-29T00:00:00.000Z",
};

const CATALOGUE = [
  { id: 1, name: "Taza de barro", price_mxn: 480, image_path: null, status: "published", expires_at: FAR_FUTURE, is_admin_enabled: true },
  { id: 2, name: "Jarra negra", price_mxn: 720, image_path: null, status: "draft", expires_at: null, is_admin_enabled: true },
  { id: 3, name: "Molcajete", price_mxn: 950, image_path: null, status: "published", expires_at: LONG_AGO, is_admin_enabled: true },
];

function mockCatalogue(products: unknown[] = CATALOGUE) {
  const query = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), order: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.order.mockResolvedValue({ data: products, error: null });

  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    from: vi.fn().mockReturnValue(query),
  } as never);
  return query;
}

function renderCatalog(searchParams: Record<string, string> = {}) {
  return ShopCatalogPage({
    params: Promise.resolve({ id: "4" }),
    searchParams: Promise.resolve(searchParams),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOwnedShop).mockResolvedValue(SHOP as never);
  mockCatalogue();
});

describe("shop ownership", () => {
  it("refuses a shop the signed-in user does not own", async () => {
    vi.mocked(getOwnedShop).mockResolvedValue(null);

    await expect(renderCatalog()).rejects.toThrow("NOT_FOUND");
  });

  it("refuses an id that is not a shop id", async () => {
    await expect(
      ShopCatalogPage({
        params: Promise.resolve({ id: "abc" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("the catalogue owns the page", () => {
  it("names the page after the shop", async () => {
    render(await renderCatalog());

    expect(screen.getByRole("heading", { level: 1, name: "Casa Niebla" })).toBeInTheDocument();
  });

  it("leaves the shop settings to their own view", async () => {
    // Settings used to take half the width here for edits made once in a
    // while. Nothing but a link to them belongs on the catalogue.
    render(await renderCatalog());

    expect(screen.queryByRole("heading", { name: "Editar tienda" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveAttribute(
      "href",
      "/panel/tiendas/4/ajustes",
    );
  });

  it("lists every product on the default view", async () => {
    render(await renderCatalog());

    expect(screen.getByText("Taza de barro")).toBeInTheDocument();
    expect(screen.getByText("Jarra negra")).toBeInTheDocument();
    expect(screen.getByText("Molcajete")).toBeInTheDocument();
  });

  it("counts the buckets from what the seller actually sees", async () => {
    // "Molcajete" is status published with a date long gone. It has to be
    // counted as expired, which is the state its badge already reports.
    render(await renderCatalog());

    const tabs = screen.getByRole("navigation", { name: "Estado de las publicaciones" });

    expect(within(tabs).getByRole("link", { name: "Todos 3" })).toBeInTheDocument();
    expect(within(tabs).getByRole("link", { name: "Publicados 1" })).toBeInTheDocument();
    expect(within(tabs).getByRole("link", { name: "Borradores 1" })).toBeInTheDocument();
    expect(within(tabs).getByRole("link", { name: "Vencidos 1" })).toBeInTheDocument();
  });
});

describe("filtering the catalogue", () => {
  it("shows only the chosen state", async () => {
    render(await renderCatalog({ estado: "borradores" }));

    expect(screen.getByText("Jarra negra")).toBeInTheDocument();
    expect(screen.queryByText("Taza de barro")).not.toBeInTheDocument();
  });

  it("narrows the list to a search", async () => {
    render(await renderCatalog({ buscar: "molca" }));

    expect(screen.getByText("Molcajete")).toBeInTheDocument();
    expect(screen.queryByText("Taza de barro")).not.toBeInTheDocument();
  });

  it("keeps every count whole while a filter is on", async () => {
    render(await renderCatalog({ estado: "borradores" }));

    const tabs = screen.getByRole("navigation", { name: "Estado de las publicaciones" });

    expect(within(tabs).getByRole("link", { name: "Todos 3" })).toBeInTheDocument();
  });

  it("offers a way out when a filter matches nothing", async () => {
    // A dead end here looks like a lost catalogue. The empty state has to say
    // the filter is why, and undo it in one tap.
    render(await renderCatalog({ estado: "vencidos", buscar: "taza" }));

    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todos los productos" })).toHaveAttribute(
      "href",
      "/panel/tiendas/4",
    );
  });
});

describe("an empty catalogue", () => {
  it("invites the first product instead of blaming a filter", async () => {
    mockCatalogue([]);

    render(await renderCatalog());

    expect(screen.getByText("Catálogo vacío")).toBeInTheDocument();
    expect(screen.queryByText("Sin resultados")).not.toBeInTheDocument();
  });
});

describe("confianza", () => {
  it("stays out of the catalogue's way when there is no dashboard", async () => {
    render(await renderCatalog());

    expect(screen.queryByText("Confianza")).not.toBeInTheDocument();
  });
});
