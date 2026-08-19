import { DEFAULT_CATALOG_LOCALE } from "@/lib/catalog-locale";

export function formatCurrency(
  value: number | string,
  currencyCode: string,
  locale = DEFAULT_CATALOG_LOCALE,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatMxn(value: number | string) {
  return formatCurrency(value, "MXN");
}
