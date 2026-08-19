import { describe, expect, it } from "vitest";

import {
  CATEGORY_ICON_BY_ROOT_SLUG,
  buildCatalogHref,
  findCategorySelection,
  type CategoryTree,
} from "@/lib/categories";
import { normalizeCatalogLocale } from "@/lib/catalog-locale";

const tree: CategoryTree[] = [
  {
    id: 2,
    parentId: null,
    slug: "electronica",
    name: "Electrónica",
    sortOrder: 1,
    isActive: true,
    children: [
      {
        id: 22,
        parentId: 2,
        slug: "celulares-y-accesorios",
        name: "Celulares y accesorios",
        sortOrder: 1,
        isActive: true,
      },
    ],
  },
];

describe("catalog locale", () => {
  it("keeps supported locales and falls back to Spanish for unknown values", () => {
    expect(normalizeCatalogLocale("en-US")).toBe("en-US");
    expect(normalizeCatalogLocale("fr-FR")).toBe("es-MX");
  });
});

describe("findCategorySelection", () => {
  it("resolves a leaf to its parent and leaf IDs", () => {
    expect(findCategorySelection(tree, 22)).toEqual({ parentId: 2, leafId: 22 });
  });

  it("keeps a root selection without inventing a leaf", () => {
    expect(findCategorySelection(tree, 2)).toEqual({ parentId: 2, leafId: null });
  });

  it("returns an empty selection for unknown or absent IDs", () => {
    expect(findCategorySelection(tree, 999)).toEqual({ parentId: null, leafId: null });
    expect(findCategorySelection(tree, null)).toEqual({ parentId: null, leafId: null });
  });
});

describe("buildCatalogHref", () => {
  it("combines and encodes search and category filters", () => {
    expect(buildCatalogHref({ query: "iphone", categorySlug: "electronica" })).toBe(
      "/?q=iphone&categoria=electronica",
    );
    expect(
      buildCatalogHref({
        query: "café molido",
        categorySlug: "alimentos-y-bebidas",
        subcategorySlug: "despensa",
      }),
    ).toBe("/?q=caf%C3%A9+molido&categoria=alimentos-y-bebidas&subcategoria=despensa");
  });

  it("returns the catalog root when every filter is empty", () => {
    expect(buildCatalogHref({ query: "  " })).toBe("/");
  });
});

describe("CATEGORY_ICON_BY_ROOT_SLUG", () => {
  it("covers every initial root category with its stable icon name", () => {
    expect(CATEGORY_ICON_BY_ROOT_SLUG).toEqual({
      electronica: "electronics",
      "hogar-y-jardin": "home",
      "moda-y-accesorios": "fashion",
      "belleza-y-cuidado-personal": "beauty",
      "alimentos-y-bebidas": "food",
      "deportes-y-aire-libre": "sports",
      "bebes-ninas-y-ninos": "kids",
      "arte-papeleria-y-manualidades": "art",
      mascotas: "pets",
      automotriz: "automotive",
      "libros-medios-y-coleccionables": "books",
    });
  });
});
