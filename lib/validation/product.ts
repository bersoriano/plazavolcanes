import { z } from "zod";

import { DEFAULT_CATALOG_CURRENCY, DEFAULT_CATALOG_LOCALE } from "@/lib/catalog-locale";

export const productStatusSchema = z.enum(["draft", "published"]);
export const productConditionSchema = z.enum(["new", "used"]);
export const usedConditionSchema = z.enum(["mint", "good", "fair", "bad", "scrap"]);

const productFields = {
  name: z
    .string()
    .trim()
    .refine((value) => value.length >= 3 && value.length <= 120, {
      message: "El nombre debe tener entre 3 y 120 caracteres.",
    }),
  description: z
    .string()
    .trim()
    .refine((value) => value.length >= 20 && value.length <= 3000, {
      message: "La descripción debe tener entre 20 y 3000 caracteres.",
    }),
  price_mxn: z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Escribe un precio válido con máximo dos decimales.")
    .transform(Number)
    .refine((value) => value <= 9_999_999_999.99, {
      message: "El precio excede el máximo permitido.",
    }),
  condition: productConditionSchema,
  used_condition: z.preprocess(
    (value) => (value === "" ? null : value),
    usedConditionSchema.nullable(),
  ),
  category_id: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.coerce.number().int().positive().nullable(),
  ),
  handling_days: z.preprocess(
    (value) => (value == null || value === "" ? 3 : value),
    z.coerce.number().int().min(1, "El tiempo mínimo es un día hábil.").max(30, "El tiempo máximo es 30 días hábiles."),
  ),
  units_available: z.preprocess(
    (value) => (value == null || value === "" ? 1 : value),
    z.coerce
      .number()
      .int("Escribe un número entero de unidades.")
      .min(1, "Publica al menos 1 unidad.")
      .max(10, "El máximo es 10 unidades."),
  ),
  currency_code: z.literal(DEFAULT_CATALOG_CURRENCY).default(DEFAULT_CATALOG_CURRENCY),
  content_locale: z.literal(DEFAULT_CATALOG_LOCALE).default(DEFAULT_CATALOG_LOCALE),
};

function validateCondition(
  product: { condition: "new" | "used"; used_condition: "mint" | "good" | "fair" | "bad" | "scrap" | null },
  context: z.RefinementCtx,
) {
  if (product.condition === "used" && product.used_condition === null) {
    context.addIssue({
      code: "custom",
      message: "Selecciona el estado del producto usado.",
      path: ["used_condition"],
    });
  }

  if (product.condition === "new" && product.used_condition !== null) {
    context.addIssue({
      code: "custom",
      message: "Un producto nuevo no puede tener estado de uso.",
      path: ["used_condition"],
    });
  }
}

export const productCreationSchema = z.object(productFields).superRefine(validateCondition);

export const productSchema = z.object({
  ...productFields,
  status: productStatusSchema,
}).superRefine((product, context) => {
  validateCondition(product, context);

  if (product.status === "published" && product.category_id === null) {
    context.addIssue({
      code: "custom",
      message: "Selecciona una subcategoría válida antes de publicar.",
      path: ["category_id"],
    });
  }
});

export type ProductInput = z.infer<typeof productSchema>;
export type ProductCreationInput = z.infer<typeof productCreationSchema>;
