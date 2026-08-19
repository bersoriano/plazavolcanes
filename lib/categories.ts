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
};

export function buildCatalogHref({
  query,
  categorySlug,
  subcategorySlug,
}: CatalogHrefFilters): string {
  const searchParams = new URLSearchParams();
  const normalizedQuery = query?.trim();

  if (normalizedQuery) searchParams.set("q", normalizedQuery);
  if (categorySlug) searchParams.set("categoria", categorySlug);
  if (subcategorySlug) searchParams.set("subcategoria", subcategorySlug);

  const queryString = searchParams.toString();
  return queryString ? `/?${queryString}` : "/";
}
