export const SUPPORTED_CATALOG_LOCALES = ["es-MX", "en-US"] as const;

export type CatalogLocale = (typeof SUPPORTED_CATALOG_LOCALES)[number];

export const DEFAULT_CATALOG_LOCALE: CatalogLocale = "es-MX";
export const DEFAULT_CATALOG_MARKET = "MX" as const;
export const DEFAULT_CATALOG_CURRENCY = "MXN" as const;
/** Where the plaza keeps its clock when a reader's own zone is not known yet. */
export const DEFAULT_CATALOG_TIME_ZONE = "America/Mexico_City";

export function normalizeCatalogLocale(value: unknown): CatalogLocale {
  return value === "en-US" || value === "es-MX" ? value : DEFAULT_CATALOG_LOCALE;
}
