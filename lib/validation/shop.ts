import { z } from "zod";

import {
  MAX_ADMINISTRATIVE_AREAS,
  MEXICO_ADMINISTRATIVE_AREA_CODES,
} from "@/lib/shop-location";

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
  administrative_area_codes: z
    .array(z.enum(MEXICO_ADMINISTRATIVE_AREA_CODES, { error: "Selecciona un estado." }))
    .min(1, { error: "Selecciona un estado." })
    .max(MAX_ADMINISTRATIVE_AREAS, { error: "Puedes elegir hasta 2 estados." })
    .refine((codes) => new Set(codes).size === codes.length, {
      error: "Elige dos estados distintos.",
    }),
});

export type ShopInput = z.infer<typeof shopSchema>;
