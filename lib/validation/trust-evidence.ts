import { z } from "zod";

const optionalText = (maximum: number) => z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(maximum).nullable().optional().transform((value) => value ?? null),
);

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Selecciona una calificación.").max(5, "Selecciona una calificación válida."),
  matched_description: z.enum(["true", "false"]).transform((value) => value === "true"),
  comment: optionalText(2000),
});

export const disputeSchema = z.object({
  reason: z.enum(["item_not_received", "item_not_as_described", "damaged_item", "other"]),
  statement: z.string().trim().min(10, "Explica lo sucedido con al menos 10 caracteres.").max(3000),
});

export const disputeResponseSchema = z.object({
  response: z.string().trim().min(10, "Responde con al menos 10 caracteres.").max(3000),
});

export const resolutionSchema = z.object({
  resolution: z.enum(["buyer_favor", "seller_favor", "dismissed"]),
  seller_fault: z.enum(["true", "false"]).transform((value) => value === "true"),
  notes: z.string().trim().min(10, "Documenta la resolución con al menos 10 caracteres.").max(3000),
});
