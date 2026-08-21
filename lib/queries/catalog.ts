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
  categorySlug?: string;
  subcategorySlug?: string;
  administrativeAreaSlug?: string;
  administrativeAreaCode?: string;
  locale: CatalogLocale;
  countryCode: string;
  invalidCategorySelection: boolean;
  invalidAreaSelection: boolean;
};

type CatalogSearchParams = {
  q?: string | string[];
  categoria?: string | string[];
  subcategoria?: string | string[];
  estado?: string | string[];
  locale?: string | string[];
  countryCode?: string | string[];
};

const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCategorySlug(value: string | string[] | undefined) {
  const slug = firstValue(value)?.trim();
  return slug && CATEGORY_SLUG_PATTERN.test(slug) ? slug : undefined;
}

export function normalizeSearchQuery(query: string | undefined) {
  const normalized = query?.trim().slice(0, 80);
  return normalized || undefined;
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

  return {
    query: normalizeSearchQuery(firstValue(params.q)),
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
