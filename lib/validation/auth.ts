import { z } from "zod";

export const authSchema = z.object({
  email: z.email("Escribe un correo válido."),
  password: z.string().min(8, "Usa al menos 8 caracteres."),
});

export type AuthInput = z.infer<typeof authSchema>;
