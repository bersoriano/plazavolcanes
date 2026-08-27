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

/**
 * The pickup point is its own schema rather than a refinement of `shopSchema`,
 * because it is written to its own table. A shop offers collection exactly when
 * this parses, and the seller unchecking the option deletes the row instead.
 */
export const pickupPointSchema = z.object({
  address_line1: z
    .string()
    .trim()
    .refine((value) => value.length >= 3 && value.length <= 200, {
      message: "Escribe la calle y el número.",
    }),
  locality: z
    .string()
    .trim()
    .refine((value) => value.length >= 2 && value.length <= 120, {
      message: "Escribe la ciudad o localidad.",
    }),
  administrative_area_code: z.enum(MEXICO_ADMINISTRATIVE_AREA_CODES, {
    error: "Selecciona un estado.",
  }),
  postal_code: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, { message: "El código postal tiene 5 dígitos." }),
  notes: z
    .string()
    .trim()
    .max(500, { error: "Las referencias no pueden pasar de 500 caracteres." })
    .transform((value) => value || null)
    .nullable()
    .default(null),
});

export type PickupPointInput = z.infer<typeof pickupPointSchema>;
