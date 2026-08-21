import { z } from "zod";

export const authSchema = z.object({
  email: z.email("Escribe un correo válido."),
  password: z.string().min(8, "Usa al menos 8 caracteres."),
});

const PHONE_ERROR = "Escribe tu teléfono móvil a 10 dígitos.";

/**
 * Accepts a Mexican mobile number however it was typed and returns its E.164
 * form, or null when the digits cannot make one.
 */
export function normalizeMexicanMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  // A pasted number may already carry the country code.
  const national = digits.length === 12 && digits.startsWith("52") ? digits.slice(2) : digits;

  return national.length === 10 ? `+52${national}` : null;
}

export const mexicanMobileSchema = z
  .string({ error: PHONE_ERROR })
  .transform((value) => normalizeMexicanMobile(value))
  .refine((value): value is string => value !== null, { error: PHONE_ERROR });

export const signUpSchema = authSchema.extend({
  phone: mexicanMobileSchema,
});

export const phoneSchema = z.object({ phone: mexicanMobileSchema });

export type AuthInput = z.infer<typeof authSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
