import { readSearchCriteria, type SearchCriteria } from "@/lib/search/criteria";
import {
  findAdministrativeAreaBySlug,
} from "@/lib/shop-location";
import {
  DEFAULT_CATALOG_MARKET,
  normalizeCatalogLocale,
  type CatalogLocale,
} from "@/lib/catalog-locale";

export type CatalogFilters = {
  query?: string;
  criteria?: SearchCriteria;
  searchError?: string;
  originalQuery?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  administrativeAreaSlug?: string;
  administrativeAreaCode?: string;
  locale: CatalogLocale;
  countryCode: string;
  invalidCategorySelection: boolean;
  invalidAreaSelection: boolean;
};

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

/** Move a submitted request to its route before rewriting text into criteria. */
export function submittedCatalogHref(params: CatalogSearchParams, stateSlug?: string) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (stateSlug && key === "estado") continue;
    if (typeof value === "string") search.append(key, value);
    else value?.forEach((item) => search.append(key, item));
  }
  const path = stateSlug ? `/estado/${encodeURIComponent(stateSlug)}` : "/";
  return search.size ? `${path}?${search}` : path;
}

const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCategorySlug(value: string | string[] | undefined) {
  const slug = firstValue(value)?.trim();
  return slug && CATEGORY_SLUG_PATTERN.test(slug) ? slug : undefined;
}

export function hasCatalogSearch(filters: CatalogFilters) {
  return Boolean(filters.query || filters.criteria || filters.searchError);
}

export function escapePostgresLikePattern(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function normalizeCatalogFilters(params: CatalogSearchParams): CatalogFilters {
  const countryCode = firstValue(params.countryCode)?.trim().toUpperCase();
  const rawCategorySlug = firstValue(params.categoria)?.trim();
  const rawSubcategorySlug = firstValue(params.subcategoria)?.trim();
  const categorySlug = normalizeCategorySlug(params.categoria);
  const subcategorySlug = normalizeCategorySlug(params.subcategoria);
  const rawAreaSlug = firstValue(params.estado)?.trim();
  const area = findAdministrativeAreaBySlug(normalizeCategorySlug(params.estado));

  const { criteria, original, error } = readSearchCriteria(params);
  return {
    query: criteria.text,
    ...(Object.keys(criteria).length ? { criteria } : {}),
    ...(original ? { originalQuery: original } : {}),
    ...(error ? { searchError: error } : {}),
    categorySlug,
    subcategorySlug,
    administrativeAreaSlug: area?.slug,
    administrativeAreaCode: area?.code,
    locale: normalizeCatalogLocale(firstValue(params.locale)),
    countryCode: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : DEFAULT_CATALOG_MARKET,
    invalidCategorySelection: Boolean(
      (rawCategorySlug && !categorySlug) || (rawSubcategorySlug && !subcategorySlug),
    ),
    invalidAreaSelection: Boolean(rawAreaSlug && !area),
  };
}
