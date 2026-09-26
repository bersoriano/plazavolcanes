import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExplorePage, { metadata } from "@/app/explorar/page";
import { getCatalogStateCounts, getHomeCatalog } from "@/lib/queries/catalog.server";

vi.mock("@/lib/queries/catalog.server", () => ({
  getHomeCatalog: vi.fn(async () => ({
    products: [],
    shops: [],
    categories: [],
    selectedCategory: null,
    selectedSubcategory: null,
    invalidCategorySelection: false,
    searchEventId: null,
  })),
  getCatalogStateCounts: vi.fn(async () => []),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("/explorar", () => {
  it("shows the whole unfiltered catalogue with the state explorer", async () => {
    vi.mocked(getCatalogStateCounts).mockResolvedValue([{ code: "MX-JAL", count: 3 }]);

    render(await ExplorePage({ searchParams: Promise.resolve({}) }));

    expect(vi.mocked(getHomeCatalog).mock.calls[0][0]).toMatchObject({ query: undefined, categorySlug: undefined });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Descubrimientos de la plaza." })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Explora por estado." })).toBeInTheDocument();
  });

  it("is its own canonical page", () => {
    expect(metadata.alternates).toEqual({ canonical: "/explorar" });
  });
});
