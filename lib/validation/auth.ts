import { z } from "zod";

export const emailSchema = z.object({
  email: z.email("Escribe un correo válido."),
});

const passwordSchema = z.string().min(8, "Usa al menos 8 caracteres.");

export const authSchema = emailSchema.extend({
  password: passwordSchema,
});

/**
 * A password typed twice, for the recovery form. The mismatch lands on the
 * confirmation field so the message appears under the box that has to change.
 */
export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    password_confirm: z.string(),
  })
  .refine((values) => values.password === values.password_confirm, {
    error: "Las contraseñas no coinciden.",
    path: ["password_confirm"],
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

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Tu nombre debe tener entre 2 y 40 caracteres.")
  .max(40, "Tu nombre debe tener entre 2 y 40 caracteres.");

export const signUpSchema = authSchema.extend({
  phone: mexicanMobileSchema,
  display_name: displayNameSchema,
});

export const phoneSchema = z.object({ phone: mexicanMobileSchema });

export type AuthInput = z.infer<typeof authSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
