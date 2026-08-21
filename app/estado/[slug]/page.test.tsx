import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StatePage, { generateMetadata } from "@/app/estado/[slug]/page";
import { getHomeCatalog } from "@/lib/queries/catalog.server";

vi.mock("@/lib/queries/catalog.server", () => ({
  getHomeCatalog: vi.fn(),
  getCatalogStateCounts: vi.fn(),
}));

const notFound = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ notFound, redirect: vi.fn() }));

function emptyCatalog() {
  return {
    products: [],
    shops: [],
    categories: [],
    selectedCategory: null,
    selectedSubcategory: null,
    invalidCategorySelection: false,
    searchEventId: null,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("State catalog page", () => {
  it("scopes the catalog query to the state in the path", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(emptyCatalog());

    render(
      await StatePage({
        params: Promise.resolve({ slug: "jalisco" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(vi.mocked(getHomeCatalog).mock.calls[0][0]).toMatchObject({
      administrativeAreaSlug: "jalisco",
      administrativeAreaCode: "MX-JAL",
    });
    expect(screen.getByRole("heading", { level: 1, name: "Productos en Jalisco" })).toBeInTheDocument();
  });

  it("keeps a search inside the state", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(emptyCatalog());

    render(
      await StatePage({
        params: Promise.resolve({ slug: "oaxaca" }),
        searchParams: Promise.resolve({ q: "taza" }),
      }),
    );

    expect(vi.mocked(getHomeCatalog).mock.calls[0][0]).toMatchObject({
      administrativeAreaCode: "MX-OAX",
      query: "taza",
    });
  });

  it("returns a not found response for a state outside the catalog", async () => {
    vi.mocked(getHomeCatalog).mockResolvedValue(emptyCatalog());

    await StatePage({
      params: Promise.resolve({ slug: "california" }),
      searchParams: Promise.resolve({}),
    }).catch(() => undefined);

    expect(notFound).toHaveBeenCalled();
  });

  it("titles the page after the state", async () => {
    expect(await generateMetadata({ params: Promise.resolve({ slug: "jalisco" }) })).toMatchObject({
      title: "Productos en Jalisco — Plaza Volcanes",
    });
  });
});
