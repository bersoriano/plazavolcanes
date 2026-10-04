import "server-only";

import { hasListingCapacity } from "@/lib/listing-limits";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Publication checks shared by the product actions. They live outside the
 * `"use server"` modules on purpose: an export from one of those becomes an
 * endpoint the browser can call.
 */

export async function isPublishableCategory(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  categoryId: number | null,
) {
  if (categoryId === null) return false;

  const { data: leaf, error: leafError } = await supabase
    .from("categories")
    .select("parent_id")
    .eq("id", categoryId)
    .eq("listing_type", "product")
    .eq("is_active", true)
    .maybeSingle();
  if (leafError) throw new Error("No pudimos validar la subcategoría.");
  if (!leaf?.parent_id) return false;

  const { data: root, error: rootError } = await supabase
    .from("categories")
    .select("id")
    .eq("id", leaf.parent_id)
    .is("parent_id", null)
    .eq("listing_type", "product")
    .eq("is_active", true)
    .maybeSingle();
  if (rootError) throw new Error("No pudimos validar la subcategoría.");
  return Boolean(root);
}

export async function shopHasListingCapacity(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  shopId: number,
  listingLimit: number,
) {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("status", "published");
  if (error) throw new Error("No pudimos consultar las publicaciones activas.");
  return hasListingCapacity(count ?? 0, listingLimit);
}

export function isListingLimitDatabaseError(error: { message?: string } | null) {
  return error?.message?.includes("Límite de publicaciones alcanzado") ?? false;
}
