import "server-only";

import { DEFAULT_CATALOG_LOCALE, type CatalogLocale } from "@/lib/catalog-locale";
import type { CategoryTree } from "@/lib/categories";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type CategoryQueryRow = {
  id: number;
  parent_id: number | null;
  slug: string;
  sort_order: number;
  is_active: boolean;
  category_translations: { locale: CatalogLocale; name: string }[];
};

function compareCategories(
  left: { sortOrder: number; name: string },
  right: { sortOrder: number; name: string },
) {
  return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
}

export async function getProductCategoryTree(
  locale: CatalogLocale,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<CategoryTree[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const locales = locale === DEFAULT_CATALOG_LOCALE ? [locale] : [locale, DEFAULT_CATALOG_LOCALE];
  let query = supabase
    .from("categories")
    .select("id, parent_id, slug, sort_order, is_active, category_translations(locale, name)")
    .eq("listing_type", "product")
    .in("category_translations.locale", locales);

  if (!includeInactive) query = query.eq("is_active", true);

  const { data } = await query;
  const rows = (data ?? []) as CategoryQueryRow[];
  const visibleRows = includeInactive ? rows : rows.filter((row) => row.is_active);
  const options = visibleRows.map((row) => {
    const translation =
      row.category_translations.find((item) => item.locale === locale) ??
      row.category_translations.find((item) => item.locale === DEFAULT_CATALOG_LOCALE);

    return {
      id: row.id,
      parentId: row.parent_id,
      slug: row.slug,
      name: translation?.name ?? row.slug,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    };
  });
  const roots = options.filter((category) => category.parentId === null).sort(compareCategories);

  return roots.map((root) => ({
    ...root,
    children: options
      .filter((category) => category.parentId === root.id)
      .sort(compareCategories),
  }));
}
