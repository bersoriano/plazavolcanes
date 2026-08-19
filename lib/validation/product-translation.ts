import { z } from "zod";

export const productTranslationSchema = z
  .object({
    name: z.string().trim(),
    description: z.string().trim(),
  })
  .superRefine((translation, context) => {
    const hasName = translation.name.length > 0;
    const hasDescription = translation.description.length > 0;

    if (!hasName && !hasDescription) return;

    if (!hasName) {
      context.addIssue({
        code: "custom",
        message: "Escribe el nombre en inglés o deja ambos campos vacíos.",
        path: ["name"],
      });
    } else if (translation.name.length < 3 || translation.name.length > 120) {
      context.addIssue({
        code: "custom",
        message: "El nombre debe tener entre 3 y 120 caracteres.",
        path: ["name"],
      });
    }

    if (!hasDescription) {
      context.addIssue({
        code: "custom",
        message: "Escribe la descripción en inglés o deja ambos campos vacíos.",
        path: ["description"],
      });
    } else if (translation.description.length < 20 || translation.description.length > 3000) {
      context.addIssue({
        code: "custom",
        message: "La descripción debe tener entre 20 y 3000 caracteres.",
        path: ["description"],
      });
    }
  })
  .transform((translation) =>
    translation.name === "" && translation.description === "" ? null : translation,
  );

export type ProductTranslationInput = z.infer<typeof productTranslationSchema>;
