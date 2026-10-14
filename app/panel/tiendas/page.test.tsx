import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SellerShopsResult } from "@/lib/queries/shops.server";

const mocks = vi.hoisted(() => ({
  getSellerShops: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/queries/shops.server", () => ({ getSellerShops: mocks.getSellerShops }));

const { default: ShopsPage } = await import("@/app/panel/tiendas/page");

type Ready = Extract<SellerShopsResult, { status: "ready" }>;

function entry(id: number, overrides: Partial<Ready["shops"][number]> = {}): Ready["shops"][number] {
  return {
    shop: {
      id,
      name: `Tienda ${id}`,
      slug: `tienda-${id}`,
      image_path: null,
      is_premium: false,
      listing_limit: 25,
      trust_tier: "standard",
    },
    publishedQuotaCount: 2,
    approval: "approved",
    ...overrides,
  };
}

function ready(shops: Ready["shops"], shopLimit: number, overrides: Partial<Ready> = {}): Ready {
  return {
    status: "ready",
    shops,
    shopLimit,
    canCreateShop: shops.length < shopLimit,
    listingsLoaded: true,
    imageUrls: new Map(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("ShopsPage", () => {
  it("takes a seller with one shop and no room for another straight to its catalogue", async () => {
    // Most sellers. A list of one, with nothing else to do on it, is a tap
    // that only stands between them and their products.
    mocks.getSellerShops.mockResolvedValue(ready([entry(7)], 1));

    await expect(ShopsPage()).rejects.toThrow("REDIRECT /panel/tiendas/7");
  });

  it("lists every shop when there is more than one to choose from", async () => {
    mocks.getSellerShops.mockResolvedValue(ready([entry(7), entry(9)], 2));

    render(await ShopsPage());

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "Mis tiendas" })).toBeInTheDocument();
    const shops = within(screen.getByRole("region", { name: "Mis tiendas" }));
    expect(shops.getByRole("link", { name: /Tienda 7/ })).toHaveAttribute("href", "/panel/tiendas/7");
    expect(shops.getByRole("link", { name: /Tienda 9/ })).toHaveAttribute("href", "/panel/tiendas/9");
    expect(shops.getAllByText("2 de 25 publicaciones · Nivel Estándar")).toHaveLength(2);
  });

  it("keeps the list for one shop when another can still be created", async () => {
    // Redirecting here would hide the only way to the second shop.
    mocks.getSellerShops.mockResolvedValue(ready([entry(7)], 2));

    render(await ShopsPage());

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Tienda 7/ })).toHaveAttribute("href", "/panel/tiendas/7");
    expect(screen.getByRole("link", { name: "Crear tienda" })).toHaveAttribute("href", "/panel/tiendas/nueva");
  });

  it("invites a seller with no shop yet to create the first", async () => {
    mocks.getSellerShops.mockResolvedValue(ready([], 1));

    render(await ShopsPage());

    expect(screen.getByRole("heading", { level: 1, name: "Mis tiendas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aún no tienes una tienda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crear tienda" })).toHaveAttribute("href", "/panel/tiendas/nueva");
  });

  it("does not offer a shop to somebody who may not create one", async () => {
    mocks.getSellerShops.mockResolvedValue(ready([], 0));

    render(await ShopsPage());

    expect(screen.getByText(/Aún no puedes crear tiendas/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Crear tienda" })).toBeNull();
  });

  it("says so when the listings could not be counted", async () => {
    mocks.getSellerShops.mockResolvedValue(ready([entry(7), entry(9)], 2, { listingsLoaded: false }));

    render(await ShopsPage());

    expect(screen.getAllByText(/Publicaciones sin cargar/)).toHaveLength(2);
  });

  it("says the shops could not be read instead of claiming there are none", async () => {
    mocks.getSellerShops.mockResolvedValue({ status: "error" });

    render(await ShopsPage());

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar tus tiendas");
    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute("href", "/panel/tiendas");
    expect(screen.queryByText("Aún no tienes una tienda")).toBeNull();
  });

  it("draws nothing without a signed-in seller", async () => {
    mocks.getSellerShops.mockResolvedValue(null);

    await expect(ShopsPage()).resolves.toBeNull();
  });
});
