import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeLanding } from "@/components/home/landing/home-landing";
import { normalizeCatalogFilters } from "@/lib/queries/catalog";

describe("HomeLanding", () => {
  it("leads with buyer search and keeps a route to selling", () => {
    render(<HomeLanding catalog={{
      products: [], shops: [], categories: [], selectedCategory: null,
      selectedSubcategory: null, invalidCategorySelection: false, searchEventId: null,
    }} filters={normalizeCatalogFilters({})} stateCounts={[]} />);

    expect(screen.getByRole("heading", { name: /Encuentra algo bueno cerca de ti/ })).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conoce cómo vender" })).toHaveAttribute("href", "/vender");
    expect(screen.queryByText("Primeras 100 tiendas")).not.toBeInTheDocument();
  });
});
