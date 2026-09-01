"use server";

import { isMediaContentType, productImageKey, shopImageKey } from "@/lib/media/keys";
import { countProductImages } from "@/lib/media/product-images";
import { createUploadTicket } from "@/lib/media/store";
import { MAX_PRODUCT_IMAGES } from "@/lib/media/validation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type UploadTicket = { key: string; token: string };
export type TicketResult = { tickets: UploadTicket[]; error: null } | { tickets: null; error: string };

const denied: TicketResult = { tickets: null, error: "No pudimos preparar la subida." };

async function authenticated() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  return userId ? { supabase, userId } : null;
}

/**
 * Permission to write a fixed number of objects, checked the way the upload
 * itself used to be: the caller has to be signed in, own the shop the pictures
 * are for, and have room left in the gallery. Only the bytes moved out of the
 * application; the authorisation did not.
 */
export async function requestProductImageUploads(
  shopId: number,
  productId: number | null,
  contentTypes: string[],
): Promise<TicketResult> {
  if (!contentTypes.length || !contentTypes.every(isMediaContentType)) return denied;

  const context = await authenticated();
  if (!context) return denied;
  const { supabase, userId } = context;

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!shop) return denied;

  if (productId !== null) {
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("shop_id", shopId)
      .maybeSingle();
    if (!product) return denied;
  }

  const stored = productId === null ? 0 : await countProductImages(supabase, productId);
  if (stored + contentTypes.length > MAX_PRODUCT_IMAGES) {
    return { tickets: null, error: `Puedes subir hasta ${MAX_PRODUCT_IMAGES} imágenes.` };
  }

  const tickets: UploadTicket[] = [];
  for (const contentType of contentTypes) {
    if (!isMediaContentType(contentType)) return denied;
    const ticket = await createUploadTicket(supabase, productImageKey(userId, contentType));
    if (!ticket) return denied;
    tickets.push(ticket);
  }

  return { tickets, error: null };
}

export async function requestShopImageUpload(contentType: string): Promise<TicketResult> {
  if (!isMediaContentType(contentType)) return denied;

  const context = await authenticated();
  if (!context) return denied;

  const ticket = await createUploadTicket(
    context.supabase,
    shopImageKey(context.userId, contentType),
  );

  return ticket ? { tickets: [ticket], error: null } : denied;
}
