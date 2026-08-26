import { z } from "zod";

import { safeContinuation } from "@/lib/safe-continuation";

/**
 * What a signed-out person was trying to buy.
 *
 * It travels in a cookie rather than the URL so it survives the whole detour —
 * sign-in, registration, and the e-mail confirmation link, which starts a fresh
 * navigation no query string of ours would reach.
 */
export type PurchaseIntent = {
  productId: number;
  quantity: number;
  productPath: string | null;
};

export const PURCHASE_INTENT_COOKIE = "pv_purchase_intent";

/** Long enough to read an e-mail and come back, short enough to be forgotten. */
export const PURCHASE_INTENT_MAX_AGE = 60 * 60 * 24;

const purchaseIntentSchema = z
  .object({
    productId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    // Mirrors quantitySchema. The cookie is the person's own, but it reaches
    // the database, so its bounds are checked here too.
    quantity: z.number().int().min(1).max(99),
    productPath: z.string().nullish(),
  })
  .transform((value, ctx) => {
    const productPath = value.productPath == null ? null : safeContinuation(value.productPath);

    // A path that names another origin means the cookie was tampered with, and
    // a tampered cookie is not one to half-honour.
    if (value.productPath != null && productPath === null) {
      ctx.addIssue({ code: "custom", message: "El destino no pertenece al sitio." });
      return z.NEVER;
    }

    return { productId: value.productId, quantity: value.quantity, productPath };
  });

export function serializePurchaseIntent(intent: PurchaseIntent) {
  return JSON.stringify(intent);
}

export function parsePurchaseIntent(raw: string | undefined): PurchaseIntent | null {
  if (!raw) return null;

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = purchaseIntentSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
