import "server-only";

import type { ActionState } from "@/lib/action-state";
import { hasListingCapacity } from "@/lib/listing-limits";
import { missingForPublication, type ListingReadinessInput } from "@/lib/listing-readiness";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Publication checks shared by the product actions. They live outside the
 * `"use server"` modules on purpose: an export from one of those becomes an
 * endpoint the browser can call.
 */

/**
 * Full readiness gate for first publication, shared by editor and catalogue.
 * Call before writing status: publication consumes a slot even while awaiting
 * administration approval, and can start expiry once approval permits it.
 * imageCount must represent a stored cover or uploads verified before the
 * status write, never gallery rows alone when the derived cover is missing.
 * Already-published edits and catalogue renewals have explicit legacy rules
 * at their call sites; a draft never qualifies for that exception.
 */
export async function publicationReadinessError(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  listing: ListingReadinessInput,
): Promise<ActionState | null> {
  const missing = missingForPublication(listing);
  const errors: Record<string, string[]> = Object.fromEntries(
    missing.map(({ field, label }) => [field, [label]]),
  );
  if (listing.category_id !== null && !(await isPublishableCategory(supabase, listing.category_id))) {
    errors.category_id = ["Selecciona una subcategoría válida antes de publicar."];
  }
  if (!Object.keys(errors).length) return null;
  const message = missing[0]?.field === "images"
    ? "Agrega al menos una foto del producto antes de publicar."
    : "Completa los requisitos antes de publicar.";
  return { status: "error", message, errors };
}

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
