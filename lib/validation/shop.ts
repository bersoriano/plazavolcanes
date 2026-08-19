import { z } from "zod";

import { MEXICO_ADMINISTRATIVE_AREA_CODES } from "@/lib/shop-location";

export const shopSchema = z.object({
  name: z
    .string()
    .trim()
    .refine((value) => value.length >= 3 && value.length <= 80, {
      message: "El nombre debe tener entre 3 y 80 caracteres.",
    }),
  description: z
    .string()
    .trim()
    .refine((value) => value.length >= 20 && value.length <= 1200, {
      message: "La descripción debe tener entre 20 y 1200 caracteres.",
    }),
  country_code: z.literal("MX", { error: "País no disponible." }),
  administrative_area_code: z.enum(MEXICO_ADMINISTRATIVE_AREA_CODES, {
    error: "Selecciona un estado.",
  }),
});

export type ShopInput = z.infer<typeof shopSchema>;
