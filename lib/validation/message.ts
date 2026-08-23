import { z } from "zod";

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, "Escribe un mensaje.")
  .max(2000, "El mensaje debe tener entre 1 y 2000 caracteres.");
