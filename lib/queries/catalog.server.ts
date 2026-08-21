import "server-only";

import {
  DEFAULT_CATALOG_LOCALE,
  DEFAULT_CATALOG_MARKET,
  type CatalogLocale,
} from "@/lib/catalog-locale";
import type { CategoryOption, CategoryTree } from "@/lib/categories";
import type { Product, Shop, UserTrustProfile } from "@/lib/database.types";
import type { CatalogFilters } from "@/lib/queries/catalog";
import { escapePostgresLikePattern, normalizeSearchQuery } from "@/lib/queries/catalog";
import { getProductCategoryTree } from "@/lib/queries/categories.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCatalogImageUrl } from "@/lib/storage";

export type CatalogProduct = Pick<
  Product,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "price_mxn"
  | "condition"
  | "used_condition"
  | "created_at"
> & {
  category_id?: Product["category_id"];
  currency_code?: Product["currency_code"];
  image_path: string | null;
  shop: { name: string; slug: string };
};

export type CatalogShop = Shop & { imageUrl: string | null };

const productSelection =
  "id, slug, name, description, price_mxn, condition, used_condition, image_path, created_at, category_id, currency_code, shops!inner(name, slug, country_code), product_translations(locale, name, description, review_status)";

type ProductQueryRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price_mxn: number;
  condition: "new" | "used";
  used_condition: "mint" | "good" | "fair" | "bad" | "scrap" | null;
  image_path: string | null;
  created_at: string;
  category_id: number | null;
  currency_code: string;
  shops: { name: string; slug: string; country_code: string };
  product_translations: {
    locale: CatalogLocale;
    name: string;
    description: string;
    review_status: "draft" | "approved";
  }[];
};

function mapProduct(item: ProductQueryRow, locale: CatalogLocale): CatalogProduct {
  const translation =
    locale === "en-US"
      ? item.product_translations.find(
          (candidate) => candidate.locale === locale && candidate.review_status === "approved",
        )
      : undefined;

  return {
    id: item.id,
    slug: item.slug,
    name: translation?.name ?? item.name,
    description: translation?.description ?? item.description,
    price_mxn: item.price_mxn,
    condition: item.condition,
    used_condition: item.used_condition,
    image_path: getCatalogImageUrl(item.image_path),
    created_at: item.created_at,
    category_id: item.category_id,
    currency_code: item.currency_code,
    shop: item.shops,
  };
}

function defaultCatalogFilters(query?: string): CatalogFilters {
  return {
    query: normalizeSearchQuery(query),
    locale: DEFAULT_CATALOG_LOCALE,
    countryCode: DEFAULT_CATALOG_MARKET,
    invalidCategorySelection: false,
    invalidAreaSelection: false,
  };
}

function resolveCategorySelection(categories: CategoryTree[], filters: CatalogFilters) {
  const selectedCategory =
    categories.find((category) => category.slug === filters.categorySlug) ?? null;
  const selectedSubcategory =
    selectedCategory?.children.find(
      (subcategory) => subcategory.slug === filters.subcategorySlug,
    ) ?? null;
  const invalidCategorySelection = Boolean(
    filters.invalidCategorySelection ||
      (filters.categorySlug && !selectedCategory) ||
      (filters.subcategorySlug && !selectedSubcategory),
  );

  return {
    selectedCategory,
    selectedSubcategory,
    invalidCategorySelection,
    categoryId: invalidCategorySelection
      ? null
      : (selectedSubcategory?.id ?? selectedCategory?.id ?? null),
  };
}

function getFallbackLeafIds(
  selectedCategory: CategoryTree | null,
  selectedSubcategory: CategoryOption | null,
) {
  if (selectedSubcategory) return [selectedSubcategory.id];
  return selectedCategory?.children.map((category) => category.id) ?? [];
}

export async function getHomeCatalog(filters?: CatalogFilters | string) {
  const normalizedFilters =
    typeof filters === "string" || filters === undefined
      ? defaultCatalogFilters(filters)
      : filters;

  if (!isSupabaseConfigured()) {
    return {
      products: [] as CatalogProduct[],
      shops: [] as CatalogShop[],
      categories: [] as CategoryTree[],
      selectedCategory: null,
      selectedSubcategory: null,
      invalidCategorySelection: normalizedFilters.invalidCategorySelection,
      searchEventId: null as string | null,
    };
  }

  const [supabase, categories] = await Promise.all([
    createServerSupabaseClient(),
    getProductCategoryTree(normalizedFilters.locale),
  ]);
  const selection = resolveCategorySelection(categories, normalizedFilters);
  const areaCode = normalizedFilters.administrativeAreaCode ?? null;
  const hasCatalogFilter = Boolean(
    normalizedFilters.query || selection.categoryId || areaCode,
  );
  let shopsQuery = supabase
    .from("shops")
    .select("*")
    .eq("country_code", normalizedFilters.countryCode)
    .order("created_at", { ascending: false })
    .limit(8);

  if (areaCode) {
    shopsQuery = shopsQuery.overlaps("administrative_area_codes", [areaCode]);
  }
  let productRows: ProductQueryRow[] = [];

  if (hasCatalogFilter) {
    let rankedRows: { product_id: number; rank: number }[] = [];
    let rankedSearchFailed = false;

    try {
      const rankedResult = await supabase.rpc("search_product_ids", {
        p_query: normalizedFilters.query ?? "",
        p_locale: normalizedFilters.locale,
        p_country_code: normalizedFilters.countryCode,
        p_administrative_area_code: areaCode,
        p_category_id: selection.categoryId,
        p_limit: 24,
      });
      rankedSearchFailed = Boolean(rankedResult.error);
      rankedRows = rankedResult.data ?? [];
    } catch {
      rankedSearchFailed = true;
    }

    if (!rankedSearchFailed) {
      const rankedIds = rankedRows.map((item) => item.product_id);

      if (rankedIds.length) {
        const { data } = await supabase
          .from("products")
          .select(productSelection)
          .eq("status", "published")
          .in("id", rankedIds);
        const rankById = new Map(rankedIds.map((id, index) => [id, index]));
        productRows = ((data ?? []) as unknown as ProductQueryRow[]).sort(
          (left, right) =>
            (rankById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (rankById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
        );
      }
    } else {
      const fallbackLeafIds = getFallbackLeafIds(
        selection.invalidCategorySelection ? null : selection.selectedCategory,
        selection.invalidCategorySelection ? null : selection.selectedSubcategory,
      );

      if (
        selection.invalidCategorySelection ||
        !selection.selectedCategory ||
        fallbackLeafIds.length
      ) {
        let fallbackQuery = supabase
          .from("products")
          .select(productSelection)
          .eq("status", "published")
          .eq("shops.country_code", normalizedFilters.countryCode)
          .order("created_at", { ascending: false })
          .limit(24);

        if (areaCode) {
          fallbackQuery = fallbackQuery.overlaps("shops.administrative_area_codes", [areaCode]);
        }
        if (normalizedFilters.query) {
          fallbackQuery = fallbackQuery.ilike(
            "name",
            `%${escapePostgresLikePattern(normalizedFilters.query)}%`,
          );
        }
        if (!selection.invalidCategorySelection && selection.selectedCategory) {
          fallbackQuery = fallbackQuery.in("category_id", fallbackLeafIds);
        }

        const { data } = await fallbackQuery;
        productRows = (data ?? []) as unknown as ProductQueryRow[];
      }
    }
  } else {
    const { data } = await supabase
      .from("products")
      .select(productSelection)
      .eq("status", "published")
      .eq("shops.country_code", normalizedFilters.countryCode)
      .order("created_at", { ascending: false })
      .limit(24);
    productRows = (data ?? []) as unknown as ProductQueryRow[];
  }

  const products = productRows.map((item) => mapProduct(item, normalizedFilters.locale));
  let searchEventId: string | null = null;

  if (hasCatalogFilter) {
    const telemetryQuery =
      normalizedFilters.query ??
      selection.selectedSubcategory?.slug ??
      selection.selectedCategory?.slug;

    if (telemetryQuery) {
      try {
        const telemetryResult = await supabase.rpc("record_catalog_search", {
          p_query: telemetryQuery,
          p_locale: normalizedFilters.locale,
          p_country_code: normalizedFilters.countryCode,
          p_category_id: selection.categoryId,
          p_result_count: products.length,
        });
        if (!telemetryResult.error) searchEventId = telemetryResult.data;
      } catch {
        // Catalog telemetry is best effort and must never hide product results.
      }
    }
  }

  const shopsResult = await shopsQuery;

  return {
    products,
    shops: (shopsResult.data ?? []).map((shop) => ({
      ...shop,
      imageUrl: getCatalogImageUrl(shop.image_path),
    })),
    categories,
    selectedCategory: selection.selectedCategory,
    selectedSubcategory: selection.selectedSubcategory,
    invalidCategorySelection: selection.invalidCategorySelection,
    searchEventId,
  };
}

export type CatalogStateCount = { code: string; count: number };

export async function getCatalogStateCounts(
  countryCode: string = DEFAULT_CATALOG_MARKET,
): Promise<CatalogStateCount[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();

  try {
    const { data, error } = await supabase.rpc("catalog_state_counts", {
      p_country_code: countryCode,
    });
    if (error) return [];

    return (data ?? []).map((row) => ({
      code: row.administrative_area_code,
      count: Number(row.product_count),
    }));
  } catch {
    // Discovery counts are decoration; the catalog must render without them.
    return [];
  }
}

export async function getPublicShop(
  slug: string,
  locale: CatalogLocale = DEFAULT_CATALOG_LOCALE,
) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data: shop } = await supabase.from("shops").select("*").eq("slug", slug).maybeSingle();
  if (!shop) return null;

  const [{ data: products }, { data: trustProfile }] = await Promise.all([
    supabase
      .from("products")
      .select(productSelection)
      .eq("shop_id", shop.id)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    supabase
      .from("user_trust_profiles")
      .select("joined_on, verification_level")
      .eq("user_id", shop.owner_id)
      .maybeSingle(),
  ]);

  return {
    ...shop,
    imageUrl: getCatalogImageUrl(shop.image_path),
    trust_profile: trustProfile as Pick<
      UserTrustProfile,
      "joined_on" | "verification_level"
    > | null,
    products: ((products ?? []) as unknown as ProductQueryRow[]).map((product) =>
      mapProduct(product, locale),
    ),
  };
}

export async function getPublicProduct(
  slug: string,
  locale: CatalogLocale = DEFAULT_CATALOG_LOCALE,
) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("products")
    .select(productSelection)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return data ? mapProduct(data as unknown as ProductQueryRow, locale) : null;
}
