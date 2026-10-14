import { z } from "zod";

import { mexicanMobileSchema } from "@/lib/validation/auth";

/** A form sends an empty field as "", and a missing one not at all. */
const text = z.preprocess((value) => (typeof value === "string" ? value.trim() : ""), z.string());

const MESSAGE_ERROR = "Escribe un mensaje de entre 10 y 2000 caracteres.";

const message = text.pipe(z.string().min(10, MESSAGE_ERROR).max(2000, MESSAGE_ERROR));

/** What a signed-in person writes: the account already says who they are. */
export const contactMessageSchema = z.object({ message });

/** What a visitor without an account writes, with how to answer them. */
export const visitorContactMessageSchema = z.object({
  name: text.pipe(
    z
      .string()
      .min(2, "Escribe tu nombre.")
      .max(120, "Tu nombre debe tener 120 caracteres o menos."),
  ),
  email: text.pipe(z.email("Escribe un correo válido.").max(254, "Escribe un correo válido.")),
  phone: mexicanMobileSchema,
  message,
});

export type VisitorContactMessage = z.infer<typeof visitorContactMessageSchema>;
