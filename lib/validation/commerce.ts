import { z } from "zod";

const trimmed = (minimum: number, maximum: number, message: string) =>
  z.string().trim().min(minimum, message).max(maximum, message);

const optionalTrimmed = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(maximum).nullable().optional().transform((value) => value ?? null),
  );

export const quantitySchema = z.coerce
  .number()
  .int("La cantidad debe ser un número entero.")
  .min(1, "Agrega al menos una unidad.")
  .max(99, "Puedes solicitar máximo 99 unidades.");

export const fulfillmentMethodSchema = z.enum(["pickup", "shipping"], {
  error: "Elige recolección o envío.",
});

export const altContactSchema = z
  .object({
    name: z.string().trim().max(80).transform((value) => value || null),
    phone: z
      .string()
      .trim()
      .transform((value) => (value ? (value.startsWith("+") ? value : `+52${value.replace(/\D/g, "")}`) : null))
      .refine((value) => value === null || /^\+52[0-9]{10}$/.test(value), {
        error: "El teléfono debe tener 10 dígitos.",
      }),
    note: z.string().trim().max(200).transform((value) => value || null),
  })
  .refine((value) => value.name !== null || (value.phone === null && value.note === null), {
    error: "Escribe el nombre de la otra persona.",
    path: ["name"],
  });

export const checkoutMetadataSchema = z.object({
  buyer_note: optionalTrimmed(1000),
  idempotency_key: z.uuid("Falta la clave de confirmación."),
});

export const checkoutSchema = z
  .object({
    recipient: trimmed(2, 120, "Escribe el nombre de quien recibe."),
    address_line1: trimmed(3, 200, "Escribe la calle y número."),
    address_line2: optionalTrimmed(200),
    locality: trimmed(2, 120, "Escribe la ciudad o localidad."),
    administrative_area: trimmed(2, 120, "Escribe el estado o provincia."),
    postal_code: trimmed(3, 20, "Escribe un código postal válido."),
    country_code: z.string().trim().regex(/^[A-Z]{2}$/, "Selecciona un país válido."),
    delivery_instructions: optionalTrimmed(500),
  })
  .extend(checkoutMetadataSchema.shape);

export type CheckoutInput = z.infer<typeof checkoutSchema>;
