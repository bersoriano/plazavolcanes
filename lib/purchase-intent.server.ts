import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { insertCartItem } from "@/lib/cart-insert";
import type { Database } from "@/lib/database.types";
import {
  PURCHASE_INTENT_COOKIE,
  PURCHASE_INTENT_MAX_AGE,
  parsePurchaseIntent,
  serializePurchaseIntent,
  type PurchaseIntent,
} from "@/lib/purchase-intent";

export async function savePurchaseIntent(intent: PurchaseIntent) {
  const store = await cookies();

  store.set(PURCHASE_INTENT_COOKIE, serializePurchaseIntent(intent), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PURCHASE_INTENT_MAX_AGE,
  });
}

export async function readPurchaseIntent() {
  const store = await cookies();
  return parsePurchaseIntent(store.get(PURCHASE_INTENT_COOKIE)?.value);
}

export async function clearPurchaseIntent() {
  const store = await cookies();
  store.delete(PURCHASE_INTENT_COOKIE);
}

function withNotice(path: string, notice: string) {
  return `${path}${path.includes("?") ? "&" : "?"}compra=${notice}`;
}

/**
 * Finishes a purchase that authentication interrupted, and returns where the
 * buyer should land — or `null` when nobody was in the middle of buying.
 *
 * The intent is consumed before the item is added, so re-opening the resulting
 * URL cannot add the same product a second time.
 */
export async function resumePurchaseIntent(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const intent = await readPurchaseIntent();
  if (!intent) return null;

  await clearPurchaseIntent();

  const result = await insertCartItem(supabase, intent.productId, intent.quantity);
  const productPath = intent.productPath ?? "/";

  if (result.status === "added") return `/carrito/${result.shopId}`;

  return withNotice(productPath, result.status === "unavailable" ? "agotado" : "error");
}
