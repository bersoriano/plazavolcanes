import type { ListingStatus } from "@/components/ui/status-badge";

/**
 * What a seller is told about one listing, and whether a shopper can see it.
 *
 * Four separate switches decide this — the seller's own draft toggle, the
 * expiry date, the shop's approval, and administration's per-product flag —
 * and any one of them closed is enough to take the listing off the plaza. The
 * `status` column alone never answers the question, so everything that needs
 * the answer reads it from here.
 */
export type SellerListingFlags = {
  status: ListingStatus;
  expires_at: string | null;
  is_admin_enabled: boolean;
  is_publishing_approved: boolean;
  publishing_reviewed_at: string | null;
};

export type SellerPublicationState = {
  label: string;
  isPublic: boolean;
};

export function getSellerPublicationState(product: SellerListingFlags): SellerPublicationState {
  if (product.status === "draft") return { label: "Desactivado por ti", isPublic: false };
  if (product.status === "expired") return { label: "Vencido", isPublic: false };
  if (!product.is_publishing_approved) {
    return product.publishing_reviewed_at
      ? { label: "Tienda deshabilitada por administración", isPublic: false }
      : { label: "Esperando aprobación de administración", isPublic: false };
  }
  if (!product.is_admin_enabled) return { label: "Deshabilitado por administración", isPublic: false };
  if (!product.expires_at || new Date(product.expires_at).getTime() <= Date.now()) {
    return { label: "Vencido", isPublic: false };
  }
  return { label: "Publicado", isPublic: true };
}
