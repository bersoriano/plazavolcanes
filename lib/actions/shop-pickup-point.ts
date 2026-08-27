import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActionState } from "@/lib/action-state";
import type { Database } from "@/lib/database.types";
import { pickupPointSchema } from "@/lib/validation/shop";

/**
 * Reads the Recolección block out of the shop form. The checkbox is the whole
 * decision: unchecked means the shop stops offering collection, and the row goes.
 */
export function pickupPointFrom(formData: FormData) {
  const offered = formData.get("offers_pickup") !== null;
  if (!offered) return { offered: false as const, parsed: null };

  return {
    offered: true as const,
    parsed: pickupPointSchema.safeParse({
      address_line1: formData.get("pickup_address_line1"),
      locality: formData.get("pickup_locality"),
      administrative_area_code: formData.get("pickup_administrative_area_code"),
      postal_code: formData.get("pickup_postal_code"),
      notes: formData.get("pickup_notes") ?? "",
    }),
  };
}

/**
 * Writes or removes a shop's pickup point.
 *
 * Called before the shop row is saved, so that a rejected address never leaves
 * the seller with a saved shop and a lost pickup point. Returns null when there
 * is nothing to report.
 */
export async function savePickupPoint(
  supabase: SupabaseClient<Database>,
  shopId: number,
  formData: FormData,
): Promise<ActionState | null> {
  const { offered, parsed } = pickupPointFrom(formData);

  if (!offered) {
    const { error } = await supabase.from("shop_pickup_points").delete().eq("shop_id", shopId);
    return error ? { status: "error", message: "No pudimos quitar la recolección." } : null;
  }

  if (!parsed?.success) {
    return {
      status: "error",
      message: "Revisa los datos de recolección.",
      errors: Object.fromEntries(
        Object.entries(parsed?.error.flatten().fieldErrors ?? {}).map(([key, value]) => [
          `pickup_${key}`,
          value,
        ]),
      ),
    };
  }

  const { error } = await supabase
    .from("shop_pickup_points")
    .upsert({ shop_id: shopId, ...parsed.data, updated_at: new Date().toISOString() });

  return error ? { status: "error", message: "No pudimos guardar la recolección." } : null;
}
