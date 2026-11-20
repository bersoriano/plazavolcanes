import type { CtaType } from "@/lib/analytics";

/**
 * Who is looking at /vender, as far as its calls to action care.
 *
 * - `signed-out`: the CTAs go to seller signup, which lands on store creation.
 * - `no-shop`: signed in without a store; the CTAs go straight to creating one.
 * - `owner`: already runs a store; the CTAs become "Ir a mi panel".
 */
export type SellerViewer = "signed-out" | "no-shop" | "owner";

/** Where a CTA sits on the page, carried as ?desde= in place of analytics. */
export type SellerCtaLocation = "header" | "hero" | "fundadoras" | "pasos" | "final" | "sticky";

export function sellerViewer(signedIn: boolean, ownsShop: boolean): SellerViewer {
  if (!signedIn) return "signed-out";
  return ownsShop ? "owner" : "no-shop";
}

/**
 * The destination of a create-store CTA. The label is the caller's: each CTA
 * words the invitation its own way, and only an owner's reads "Ir a mi panel".
 */
export function sellerCtaHref(viewer: SellerViewer, location: SellerCtaLocation) {
  if (viewer === "owner") return "/panel";
  const desde = `desde=${location}`;
  return viewer === "no-shop" ? `/panel/tiendas/nueva?${desde}` : `/registro?vender=1&${desde}`;
}

export const OWNER_CTA_LABEL = "Ir a mi panel";

/**
 * The `data-cta` a create-store CTA reports to Google Analytics: a signup for a
 * visitor, a store creation for a signed-in visitor. An owner's "Ir a mi
 * panel" is navigation, not a conversion step, so it reports nothing.
 */
export function sellerCtaType(viewer: SellerViewer): Extract<CtaType, "signup" | "create_shop"> | undefined {
  if (viewer === "owner") return undefined;
  return viewer === "no-shop" ? "create_shop" : "signup";
}
