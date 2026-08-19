import { z } from "zod";

const optionalRootCategoryIdSchema = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().int().positive().nullable(),
);

const optionalContextSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(500, "Los detalles deben tener máximo 500 caracteres.").nullable(),
);

export const categorySuggestionSchema = z.object({
  suggested_name: z
    .string()
    .trim()
    .min(3, "El nombre debe tener entre 3 y 80 caracteres.")
    .max(80, "El nombre debe tener entre 3 y 80 caracteres."),
  context: optionalContextSchema,
  root_category_id: optionalRootCategoryIdSchema,
});

export type CategorySuggestionInput = z.infer<typeof categorySuggestionSchema>;
