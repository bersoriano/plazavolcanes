import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CategoryNavigation } from "@/components/catalog/category-navigation";
import { SearchBar } from "@/components/catalog/search-bar";
import type { CategoryTree } from "@/lib/categories";

const tree: CategoryTree[] = [
  {
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
        slug: "celulares-y-accesorios",
        name: "Celulares y accesorios",
        sortOrder: 1,
        isActive: true,
      },
      {
        id: 12,
        parentId: 1,
        slug: "computacion",
        name: "Computación",
        sortOrder: 2,
        isActive: true,
      },
    ],
  },
  {
    id: 2,
    parentId: null,
    slug: "hogar-y-jardin",
    name: "Hogar y jardín",
    sortOrder: 2,
    isActive: true,
    children: [],
  },
];

afterEach(cleanup);

describe("CategoryNavigation", () => {
  it("marks Todos as the current page and preserves the query in root links", () => {
    render(<CategoryNavigation activeCategorySlug={undefined} activeSubcategorySlug={undefined} query="café" tree={tree} />);

    const navigation = screen.getByRole("navigation", { name: "Categorías de productos" });
    expect(within(navigation).getByRole("link", { name: "Todos" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "Electrónica" })).toHaveAttribute(
      "href",
      "/?q=caf%C3%A9&categoria=electronica",
    );
  });

  it("reveals leaf chips and marks the selected leaf as current", () => {
    render(
      <CategoryNavigation
        activeCategorySlug="electronica"
        activeSubcategorySlug="celulares-y-accesorios"
        query="iphone"
        tree={tree}
      />,
    );

    expect(screen.getByRole("link", { name: "Electrónica" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Celulares y accesorios" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Computación" })).toHaveAttribute(
      "href",
      "/?q=iphone&categoria=electronica&subcategoria=computacion",
    );
  });

  it("clears a stale leaf when another root is selected", () => {
    render(
      <CategoryNavigation
        activeCategorySlug="electronica"
        activeSubcategorySlug="computacion"
        query="laptop"
        tree={tree}
      />,
    );

    expect(screen.getByRole("link", { name: "Hogar y jardín" })).toHaveAttribute(
      "href",
      "/?q=laptop&categoria=hogar-y-jardin",
    );
  });

  it("preserves nondefault locale and country in category links", () => {
    render(
      <CategoryNavigation
        activeCategorySlug="electronica"
        activeSubcategorySlug="computacion"
        countryCode="US"
        locale="en-US"
        query="laptop"
        tree={tree}
      />,
    );

    expect(screen.getByRole("link", { name: "Todos" })).toHaveAttribute(
      "href",
      "/?q=laptop&locale=en-US&countryCode=US",
    );
    expect(screen.getByRole("link", { name: "Hogar y jardín" })).toHaveAttribute(
      "href",
      "/?q=laptop&categoria=hogar-y-jardin&locale=en-US&countryCode=US",
    );
  });
});

describe("SearchBar", () => {
  it("keeps one visible Estado selector with the selected state", () => {
    render(<SearchBar stateSlug="jalisco" />);

    const stateSelectors = screen.getAllByRole("combobox", { name: "Estado" });
    expect(stateSelectors).toHaveLength(1);
    expect(stateSelectors[0]).toHaveValue("jalisco");
    expect(stateSelectors[0].closest("div")).not.toHaveClass("hidden");
  });

  it("keeps the Estado selector itself at least 44px high", () => {
    render(<SearchBar />);

    expect(screen.getByRole("combobox", { name: "Estado" })).toHaveClass("min-h-11");
  });

  it("keeps active category slugs when search is submitted", () => {
    render(
      <SearchBar
        categorySlug="electronica"
        defaultValue="iphone"
        subcategorySlug="celulares-y-accesorios"
      />,
    );

    expect(screen.getByDisplayValue("electronica")).toHaveAttribute("name", "categoria");
    expect(screen.getByDisplayValue("celulares-y-accesorios")).toHaveAttribute(
      "name",
      "subcategoria",
    );
  });

  it("keeps a nondefault locale and country when search is submitted", () => {
    render(<SearchBar countryCode="US" locale="en-US" />);

    expect(screen.getByDisplayValue("en-US")).toHaveAttribute("name", "locale");
    expect(screen.getByDisplayValue("US")).toHaveAttribute("name", "countryCode");
  });

  it("does not add redundant hidden fields for the default locale and country", () => {
    const { container } = render(<SearchBar countryCode="MX" locale="es-MX" />);

    expect(container.querySelector('input[name="locale"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="countryCode"]')).not.toBeInTheDocument();
  });

  it("uses the state control border as the only desktop search separator", () => {
    render(<SearchBar />);

    const searchInput = screen.getByRole("searchbox", { name: "Buscar productos" });
    const stateControl = screen.getByRole("combobox", { name: "Estado" }).closest("div");

    expect(searchInput.nextElementSibling).toBe(stateControl);
    expect(stateControl).toHaveClass("sm:border-l");
  });
});

describe("CategoryNavigation overflow guidance", () => {
  it("describes horizontal category scrolling and hides edge fades from assistive technology", () => {
    const { container } = render(<CategoryNavigation tree={tree} />);

    const guidance = screen.getByText("Desliza para ver más categorías");
    const scrollers = container.querySelectorAll(`[aria-describedby="${guidance.id}"]`);

    expect(scrollers).toHaveLength(1);
    expect(container.querySelectorAll("[aria-hidden=\"true\"].pointer-events-none")).toHaveLength(1);
  });

  it("gives an active category's subcategory scroller focus clearance on every clipped edge", () => {
    render(<CategoryNavigation activeCategorySlug="electronica" tree={tree} />);

    expect(screen.getByLabelText("Subcategorías de Electrónica")).toHaveClass("p-2", "pr-10");
  });
});
