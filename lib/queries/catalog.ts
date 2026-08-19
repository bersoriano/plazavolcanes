import {
  DEFAULT_CATALOG_MARKET,
  normalizeCatalogLocale,
  type CatalogLocale,
} from "@/lib/catalog-locale";

export type CatalogFilters = {
  query?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  locale: CatalogLocale;
  countryCode: string;
};

type CatalogSearchParams = {
  q?: string | string[];
  categoria?: string | string[];
  subcategoria?: string | string[];
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

  return {
    query: normalizeSearchQuery(firstValue(params.q)),
    categorySlug: normalizeCategorySlug(params.categoria),
    subcategorySlug: normalizeCategorySlug(params.subcategoria),
    locale: normalizeCatalogLocale(firstValue(params.locale)),
    countryCode: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : DEFAULT_CATALOG_MARKET,
  };
}
