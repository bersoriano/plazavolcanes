import { z } from "zod";
import { SUPPORTED_CATALOG_LOCALES } from "@/lib/catalog-locale";
import { findAdministrativeAreaBySlug } from "@/lib/shop-location";
import { COLORS, MATERIALS, SIZES } from "./attributes";

export const MAX_SEARCH_LENGTH = 500;
export const AMOUNT_FORMAT = /^\d{1,10}(?:\.\d{1,2})?$/;
export const isSearchTextWithinLimit = (value: string) =>
  value.length <= MAX_SEARCH_LENGTH ||
  (value.length <= MAX_SEARCH_LENGTH * 2 && Array.from(value).length <= MAX_SEARCH_LENGTH);

const amount = z.number().nonnegative().max(9_999_999_999.99)
  .refine((value) => AMOUNT_FORMAT.test(String(value)));
const slug = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const criteriaFields = z.strictObject({
  text: z.string().refine(isSearchTextWithinLimit).trim().min(1),
  min: amount, max: amount,
  minInclusive: z.boolean(), maxInclusive: z.boolean(),
  currency: z.literal("MXN"),
  condition: z.enum(["new", "used"]),
  grade: z.enum(["mint", "good", "fair", "bad", "scrap"]),
  inStock: z.boolean(),
  color: z.enum(COLORS), size: z.enum(SIZES), material: z.enum(MATERIALS),
  waterproof: z.boolean(),
}).partial();

const allFields = criteriaFields.extend({
  categorySlug: slug.optional(),
  subcategorySlug: slug.optional(),
  administrativeAreaSlug: slug.refine((value) => !!findAdministrativeAreaBySlug(value)).optional(),
  locale: z.enum(SUPPORTED_CATALOG_LOCALES).optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
});

export type CatalogSearchCriteria = z.infer<typeof allFields>;
export type SearchCriteria = z.infer<typeof criteriaFields>;

export type CriteriaResult = { criteria: CatalogSearchCriteria; error?: string; original?: string };
export const invalid = (error: string): CriteriaResult => ({ criteria: {}, error });

export function validateSearchCriteria(value: unknown): CriteriaResult {
  const checked = allFields.safeParse(value);
  if (!checked.success) return invalid("Revisa los valores de los filtros de búsqueda.");
  const criteria = checked.data;
  if (criteria.minInclusive !== undefined && criteria.min === undefined ||
      criteria.maxInclusive !== undefined && criteria.max === undefined) {
    return invalid("Indica el precio al que se aplica el límite.");
  }
  if (criteria.min !== undefined || criteria.max !== undefined) criteria.currency = "MXN";
  if (criteria.min !== undefined) criteria.minInclusive ??= true;
  if (criteria.max !== undefined) criteria.maxInclusive ??= true;
  // Prices are stored in cents. Exclusive adjacent cent values can describe an empty range.
  const firstCent = Math.round((criteria.min ?? 0) * 100) + Number(criteria.minInclusive === false);
  const lastCent = Math.round((criteria.max ?? 9_999_999_999.99) * 100) - Number(criteria.maxInclusive === false);
  if (firstCent > lastCent) return invalid("Los límites de precio no tienen valores en común.");
  if (criteria.grade && criteria.condition === "new") return invalid("El estado de conservación se aplica a artículos usados.");
  if (criteria.grade) criteria.condition = "used";
  if (criteria.subcategorySlug && !criteria.categorySlug) {
    return invalid("Selecciona una categoría para la subcategoría indicada.");
  }
  if (criteria.administrativeAreaSlug && criteria.countryCode && criteria.countryCode !== "MX") {
    return invalid("Selecciona un estado del país indicado.");
  }
  return { criteria };
}

const refinement = z.strictObject({
  reset: z.boolean().optional(),
  set: allFields.optional(),
  clear: z.array(allFields.keyof()).max(Object.keys(allFields.shape).length).optional(),
});

export function refineSearchCriteria(current: unknown, change: unknown): CriteriaResult {
  const patch = refinement.safeParse(change);
  if (!patch.success) return invalid("Revisa los cambios solicitados para la búsqueda.");
  const base = validateSearchCriteria(patch.data.reset ? {} : current);
  if (base.error) return base;
  const { clear = [], set = {} } = patch.data;
  const next = base.criteria;
  for (const field of clear) {
    if (Object.hasOwn(set, field)) return invalid("Un filtro no se puede aplicar y quitar a la vez.");
    delete next[field];
    if (field === "max") delete next.maxInclusive;
    if (field === "min") delete next.minInclusive;
    if (field === "condition") delete next.grade;
    if (field === "categorySlug") delete next.subcategorySlug;
  }
  if ((clear.includes("max") || clear.includes("min")) && next.max === undefined && next.min === undefined) {
    delete next.currency;
  }
  const updated = { ...next, ...set };
  if (clear.includes("currency") && (updated.min !== undefined || updated.max !== undefined)) {
    return invalid("Quita los límites de precio para quitar la moneda.");
  }
  return validateSearchCriteria(updated);
}

/** Intersect two independent requests. A refinement uses replacement semantics instead. */
export function intersectCriteria(left: SearchCriteria, right: SearchCriteria): CriteriaResult {
  const merged = { ...left, ...right };
  for (const key of ["waterproof", "color", "size", "material", "grade", "condition"] as const) {
    if (left[key] !== undefined && right[key] !== undefined && left[key] !== right[key]) {
      return invalid("Los filtros se contradicen. Elige un solo valor para cada característica.");
    }
  }
  if (left.inStock === true || right.inStock === true) merged.inStock = true;
  for (const bound of ["min", "max"] as const) {
    const a = left[bound], b = right[bound];
    if (a === undefined || b === undefined) continue;
    const flag = bound === "min" ? "minInclusive" : "maxInclusive";
    if (a === b) merged[flag] = left[flag] !== false && right[flag] !== false;
    else if (bound === "min" ? a > b : a < b) {
      merged[bound] = a;
      merged[flag] = left[flag] ?? true;
    }
  }
  return validateSearchCriteria(merged);
}
