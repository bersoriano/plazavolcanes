"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Counts one visit to a public product page for the shop's analytics. Best
 * effort: the database ignores drafts and the owner's own visits, and a
 * failure never reaches the visitor.
 */
export async function recordProductView(productId: number) {
  if (!Number.isSafeInteger(productId) || productId < 1 || !isSupabaseConfigured()) return;

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.rpc("record_product_view", { p_product_id: productId });
  } catch {
    // Analytics must never break a product page.
  }
}
