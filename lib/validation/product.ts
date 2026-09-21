import { z } from "zod";

import { DEFAULT_CATALOG_CURRENCY, DEFAULT_CATALOG_LOCALE } from "@/lib/catalog-locale";
import {
  MAX_HANDLING_DAYS,
  MAX_UNITS,
  MIN_HANDLING_DAYS,
  MIN_UNITS,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from "@/lib/listing-readiness";

export const productStatusSchema = z.enum(["draft", "published"]);
export const productConditionSchema = z.enum(["new", "used"]);
export const usedConditionSchema = z.enum(["mint", "good", "fair", "bad", "scrap"]);

/** An empty form field means "not decided yet", never a value to invent. */
const blankAsNull = (value: unknown) => (value === "" || value == null ? null : value);

/**
 * A product as the form submits it, with nothing filled in on the seller's
 * behalf.
 *
 * Only the name is required: a draft is a place to leave work in progress, and
 * a draft nobody can tell apart in the catalogue is not usable. Everything else
 * may be missing and is stored as null rather than as a stand-in value — a
 * price of zero, a condition of "new" or three days of handling that nobody
 * promised. What publication additionally demands lives in
 * `lib/listing-readiness.ts`, which the form and the server action both read.
 */
const productFields = {
  name: z
    .string()
    .trim()
    .refine((value) => value.length >= NAME_MIN_LENGTH && value.length <= NAME_MAX_LENGTH, {
      message: `El nombre debe tener entre ${NAME_MIN_LENGTH} y ${NAME_MAX_LENGTH} caracteres.`,
    }),
  description: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z
      .string()
      .trim()
      .max(DESCRIPTION_MAX_LENGTH, `La descripción no puede pasar de ${DESCRIPTION_MAX_LENGTH} caracteres.`)
      .nullable(),
  ),
  price_mxn: z.preprocess(
    blankAsNull,
    z
      .string()
      .trim()
      .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Escribe un precio válido con máximo dos decimales.")
      .transform(Number)
      .refine((value) => value <= 9_999_999_999.99, {
        message: "El precio excede el máximo permitido.",
      })
      .nullable(),
  ),
  condition: z.preprocess(blankAsNull, productConditionSchema.nullable()),
  used_condition: z.preprocess(blankAsNull, usedConditionSchema.nullable()),
  category_id: z.preprocess(blankAsNull, z.coerce.number().int().positive().nullable()),
  handling_days: z.preprocess(
    blankAsNull,
    z.coerce
      .number()
      .int("Escribe un número entero de días hábiles.")
      .min(MIN_HANDLING_DAYS, "El tiempo mínimo es un día hábil.")
      .max(MAX_HANDLING_DAYS, `El tiempo máximo es ${MAX_HANDLING_DAYS} días hábiles.`)
      .nullable(),
  ),
  units_available: z.preprocess(
    blankAsNull,
    z.coerce
      .number()
      .int("Escribe un número entero de unidades.")
      .min(MIN_UNITS, `Publica al menos ${MIN_UNITS} unidad.`)
      .max(MAX_UNITS, `El máximo es ${MAX_UNITS} unidades.`)
      .nullable(),
  ),
  currency_code: z.literal(DEFAULT_CATALOG_CURRENCY).default(DEFAULT_CATALOG_CURRENCY),
  content_locale: z.literal(DEFAULT_CATALOG_LOCALE).default(DEFAULT_CATALOG_LOCALE),
};

export const productDraftSchema = z.object(productFields).superRefine((product, context) => {
  // A used product may still be deciding how used it is; a new one can never
  // carry wear, whatever the browser sent.
  if (product.condition === "new" && product.used_condition !== null) {
    context.addIssue({
      code: "custom",
      message: "Un producto nuevo no puede tener estado de uso.",
      path: ["used_condition"],
    });
  }
  if (product.condition === null && product.used_condition !== null) {
    context.addIssue({
      code: "custom",
      message: "Indica si el producto es nuevo o usado.",
      path: ["condition"],
    });
  }
});

export type ProductDraftInput = z.infer<typeof productDraftSchema>;

// Existing callers still distinguish a new listing from an edit. Both use the
// deliberately permissive draft shape; publication is checked separately by
// the shared readiness gate in the server action.
export const productCreationSchema = productDraftSchema;
export const productSchema = z.object({ ...productFields, status: productStatusSchema });
export type ProductInput = z.infer<typeof productSchema>;
export type ProductCreationInput = ProductDraftInput;
