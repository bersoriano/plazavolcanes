import { z } from "zod";

const idempotencyKey = z.uuid("Falta la clave de confirmación.");

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Escribe un mensaje.").max(2000, "El mensaje no puede exceder 2000 caracteres."),
  idempotency_key: idempotencyKey,
});

export const shipmentSchema = z.object({
  tracking_text: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(500, "El seguimiento no puede exceder 500 caracteres.").nullable().optional().transform((value) => value ?? null),
  ),
  idempotency_key: idempotencyKey,
});

export const transitionSchema = z.object({
  idempotency_key: idempotencyKey,
});

export const sellerCancellationSchema = transitionSchema.extend({
  reason: z.enum(["buyer_non_payment", "inventory_unavailable", "seller_unavailable", "other"]),
});
