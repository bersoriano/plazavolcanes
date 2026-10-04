"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { MAX_UNITS } from "@/lib/listing-readiness";
import { isListingLimitDatabaseError, isPublishableCategory } from "@/lib/listing-publication.server";
import { planReactivation, reactivationMessage } from "@/lib/listing-reactivation";
import { getCatalogBucket } from "@/lib/seller-catalog";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const sessionError: ActionState = { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };

const unitsSchema = z.coerce
  .number({ error: "Escribe cuántas unidades tienes." })
  .int("Escribe un número entero de unidades.")
  .min(0, "Escribe 0 si se agotó; no puede ser negativo.")
  .max(MAX_UNITS, `El máximo es ${MAX_UNITS} unidades.`);

async function signedIn() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return userId ? { supabase, userId } : null;
}

/**
 * The catalogue row's stock field. The number is what can be ordered now:
 * units already reserved by open orders are not in it and are not touched.
 * Zero keeps a published listing up as sold out.
 */
export async function setProductUnits(productId: number, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formData.get("units_available");
  const parsed = unitsSchema.safeParse(typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa las unidades." };

  const context = await signedIn();
  if (!context) return sessionError;
  const { supabase, userId } = context;

  const { data: product } = await supabase.from("products").select("shop_id, slug, status").eq("id", productId).maybeSingle();
  if (!product || product.status === "deleted") return { status: "error", message: "Este producto ya no existe." };
  const { data: shop } = await supabase.from("shops").select("slug").eq("id", product.shop_id).eq("owner_id", userId).maybeSingle();
  if (!shop) return { status: "error", message: "No puedes editar este producto." };

  const { error } = await supabase
    .from("products")
    .update({ units_available: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) return { status: "error", message: "No pudimos guardar las unidades." };

  revalidatePath("/");
  revalidatePath("/panel");
  revalidatePath(`/panel/tiendas/${product.shop_id}`);
  revalidatePath(`/productos/${product.slug}`);
  revalidatePath(`/tiendas/${shop.slug}`);
  return { status: "success", message: "Guardado", values: { units_available: String(parsed.data) } };
}

type ShopRow = {
  id: number;
  slug: string;
  listing_limit: number;
  is_publishing_approved: boolean;
  publishing_reviewed_at: string | null;
};

type ListingRow = {
  id: number;
  name: string;
  slug: string;
  status: "published" | "expired";
  image_path: string | null;
  units_available: number | null;
  category_id: number | null;
  expires_at: string | null;
  is_admin_enabled: boolean;
  updated_at: string;
};

/**
 * "Reactivar todos": every listing the catalogue files under "Vencidos" goes
 * back up for a fresh 30 days, as long as it would pass on its own (a cover, a
 * unit, a valid subcategory, a free slot). The ones that would not stay where
 * they are and are named, so one bad listing never blocks the rest. Most
 * recently edited listings get the free slots first.
 */
export async function reactivateExpiredListings(shopId: number): Promise<ActionState> {
  const context = await signedIn();
  if (!context) return sessionError;
  const { supabase, userId } = context;

  const { data: shopData } = await supabase
    .from("shops")
    .select("id, slug, listing_limit, is_publishing_approved, publishing_reviewed_at")
    .eq("id", shopId)
    .eq("owner_id", userId)
    .maybeSingle();
  const shop = shopData as ShopRow | null;
  if (!shop) return { status: "error", message: "No puedes editar esta tienda." };

  const { data: listingData, error: listingsError } = await supabase
    .from("products")
    .select("id, name, slug, status, image_path, units_available, category_id, expires_at, is_admin_enabled, updated_at")
    .eq("shop_id", shopId)
    .in("status", ["published", "expired"]);
  if (listingsError) return { status: "error", message: "No pudimos consultar tus productos." };
  const listings = (listingData ?? []) as ListingRow[];

  const expired = listings
    .filter((listing) => getCatalogBucket(listing, shop) === "vencidos")
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  if (!expired.length) return { status: "success", message: reactivationMessage(0, []) };

  // The limit counts rows whose status says published, lapsed ones included,
  // which is also what the database's limit trigger counts.
  const publishedCount = listings.filter((listing) => listing.status === "published").length;
  const categoryIds = [...new Set(expired.map((listing) => listing.category_id).filter((id): id is number => id !== null))];
  const publishable = new Set<number>();
  try {
    for (const categoryId of categoryIds) {
      if (await isPublishableCategory(supabase, categoryId)) publishable.add(categoryId);
    }
  } catch {
    return { status: "error", message: "No pudimos validar las subcategorías." };
  }

  const plan = planReactivation(
    expired.map((listing) => ({ ...listing, needsSlot: listing.status === "expired" })),
    { publishableCategoryIds: publishable, slotsLeft: Math.max(shop.listing_limit - publishedCount, 0) },
  );

  // One statement per listing: the limit trigger cannot see rows changed
  // earlier in the same statement, so a batch could slip past the shop's
  // limit under concurrent use; one at a time, the database counts each one.
  // Sellers may not write expires_at (guard_product_administration_enablement);
  // the change of status into "published" is what earns a fresh 30 days. A
  // lapsed row whose status never left "published" is filed as expired first,
  // as the hourly sweep would have done.
  const reactivated: typeof plan.reactivate = [];
  const skipped = [...plan.skipped];
  for (const [index, listing] of plan.reactivate.entries()) {
    const now = new Date().toISOString();
    let { error } = listing.status === "published"
      ? await supabase.from("products").update({ status: "expired", updated_at: now }).eq("id", listing.id).eq("shop_id", shopId)
      : { error: null };
    if (!error) {
      ({ error } = await supabase.from("products").update({ status: "published", updated_at: now }).eq("id", listing.id).eq("shop_id", shopId));
    }
    if (isListingLimitDatabaseError(error)) {
      skipped.unshift(...plan.reactivate.slice(index).map((rest) => ({ name: rest.name, reason: "limit" as const })));
      break;
    }
    if (error) {
      revalidateCatalog(shopId, shop.slug, reactivated);
      const done = reactivated.length ? `${reactivationMessage(reactivated.length, [])} ` : "";
      return { status: "error", message: `${done}No pudimos reactivar ${reactivated.length ? "el resto" : "tus productos"}; inténtalo de nuevo.` };
    }
    reactivated.push(listing);
  }

  revalidateCatalog(shopId, shop.slug, reactivated);
  return { status: "success", message: reactivationMessage(reactivated.length, skipped) };
}

function revalidateCatalog(shopId: number, shopSlug: string, reactivated: { slug: string }[]) {
  if (!reactivated.length) return;
  revalidatePath("/");
  revalidatePath("/panel");
  revalidatePath(`/panel/tiendas/${shopId}`);
  revalidatePath(`/tiendas/${shopSlug}`);
  for (const listing of reactivated) revalidatePath(`/productos/${listing.slug}`);
}
