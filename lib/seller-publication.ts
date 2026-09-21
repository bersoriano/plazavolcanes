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

/**
 * Which switch is holding the listing back, so callers branch on the state
 * rather than on the words shown to the seller. The label is seller-facing copy
 * and may be reworded; `kind` is the contract everything else reads.
 */
export type SellerPublicationKind =
  | "draft"
  | "expired"
  | "awaiting_approval"
  | "shop_disabled"
  | "admin_disabled"
  | "published";

export type SellerPublicationState = {
  kind: SellerPublicationKind;
  label: string;
  isPublic: boolean;
};

export function getSellerPublicationState(product: SellerListingFlags): SellerPublicationState {
  // "Borrador privado" rather than a switch the seller flipped: a draft is not
  // a listing turned off, it is one nobody else can see yet.
  if (product.status === "draft") return { kind: "draft", label: "Borrador privado", isPublic: false };
  if (product.status === "expired") return { kind: "expired", label: "Vencido", isPublic: false };
  if (!product.is_publishing_approved) {
    return product.publishing_reviewed_at
      ? { kind: "shop_disabled", label: "Tienda deshabilitada por administración", isPublic: false }
      : { kind: "awaiting_approval", label: "Esperando aprobación de administración", isPublic: false };
  }
  if (!product.is_admin_enabled) {
    return { kind: "admin_disabled", label: "Deshabilitado por administración", isPublic: false };
  }
  if (!product.expires_at || new Date(product.expires_at).getTime() <= Date.now()) {
    return { kind: "expired", label: "Vencido", isPublic: false };
  }
  return { kind: "published", label: "Publicado", isPublic: true };
}
