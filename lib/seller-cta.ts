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
