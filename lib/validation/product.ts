import { z } from "zod";

export const productStatusSchema = z.enum(["draft", "published"]);
export const productConditionSchema = z.enum(["new", "used"]);
export const usedConditionSchema = z.enum(["mint", "good", "fair", "bad", "scrap"]);

export const productSchema = z.object({
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
  status: productStatusSchema,
  condition: productConditionSchema,
  used_condition: z.preprocess(
    (value) => (value === "" ? null : value),
    usedConditionSchema.nullable(),
  ),
}).superRefine((product, context) => {
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
});

export type ProductInput = z.infer<typeof productSchema>;
