import {
  DEFAULT_CATALOG_LOCALE,
  DEFAULT_CATALOG_MARKET,
  type CatalogLocale,
} from "@/lib/catalog-locale";

export type CategoryOption = {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type CategoryTree = CategoryOption & { children: CategoryOption[] };

export type CategorySelection = {
  parentId: number | null;
  leafId: number | null;
};

export type CategoryIconName =
  | "electronics"
  | "home"
  | "fashion"
  | "beauty"
  | "food"
  | "sports"
  | "kids"
  | "art"
  | "pets"
  | "automotive"
  | "books";

export const CATEGORY_ICON_BY_ROOT_SLUG = {
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
} as const satisfies Record<string, CategoryIconName>;

const EMPTY_SELECTION: CategorySelection = { parentId: null, leafId: null };

export function findCategorySelection(
  tree: CategoryTree[],
  categoryId: number | null | undefined,
): CategorySelection {
  if (categoryId == null) return EMPTY_SELECTION;

  for (const root of tree) {
    if (root.id === categoryId) return { parentId: root.id, leafId: null };

    const leaf = root.children.find((category) => category.id === categoryId);
    if (leaf) return { parentId: root.id, leafId: leaf.id };
  }

  return EMPTY_SELECTION;
}

type CatalogHrefFilters = {
  query?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  stateSlug?: string;
  locale?: CatalogLocale;
  countryCode?: string;
};

export function buildCatalogHref({
  query,
  categorySlug,
  subcategorySlug,
  stateSlug,
  locale,
  countryCode,
}: CatalogHrefFilters): string {
  const searchParams = new URLSearchParams();
  const normalizedQuery = query?.trim();

  if (normalizedQuery) searchParams.set("q", normalizedQuery);
  if (categorySlug) searchParams.set("categoria", categorySlug);
  if (subcategorySlug) searchParams.set("subcategoria", subcategorySlug);
  if (locale && locale !== DEFAULT_CATALOG_LOCALE) searchParams.set("locale", locale);
  if (countryCode && countryCode !== DEFAULT_CATALOG_MARKET) {
    searchParams.set("countryCode", countryCode);
  }

  // The state is a place, so it owns the path; everything else refines it.
  const basePath = stateSlug ? `/estado/${stateSlug}` : "/";
  const queryString = searchParams.toString();

  if (!queryString) return basePath;

  return basePath === "/" ? `/?${queryString}` : `${basePath}?${queryString}`;
}
