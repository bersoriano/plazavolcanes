import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeLanding } from "@/components/home/landing/home-landing";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";

const promo = vi.hoisted(() => ({ active: true }));
vi.mock("@/lib/launch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/launch")>()),
  isFoundersPromoActive: () => promo.active,
}));

afterEach(() => {
  cleanup();
  promo.active = true;
});

function renderLanding() {
  render(
    <HomeLanding
      catalog={{
        products: [],
        shops: [],
        categories: [],
        selectedCategory: null,
        selectedSubcategory: null,
        invalidCategorySelection: false,
        searchEventId: null,
      }}
      filters={normalizeCatalogFilters({})}
      stateCounts={[]}
    />,
  );
}

describe("HomeLanding and the founders promotion", () => {
  it("makes the founders offer while the promotion runs", () => {
    renderLanding();

    expect(screen.getByText("Primeras 100 tiendas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "0% de comisión por cada venta." })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sé de las primeras 100 tiendas." })).toBeInTheDocument();
  });

  it("takes every founders block off the page once it has ended", () => {
    promo.active = false;
    renderLanding();

    expect(screen.queryByText("Primeras 100 tiendas")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "0% de comisión por cada venta." })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Sé de las primeras 100 tiendas." })).not.toBeInTheDocument();
    // The rest of the landing stays.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vende lo tuyo. Quédate con todo.");
    expect(screen.getByRole("region", { name: "Encuentra productos únicos cerca de ti." })).toBeInTheDocument();
  });
});
