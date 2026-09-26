import { FoundersCta } from "@/components/sellers/founders-cta";
import { SellerBenefits } from "@/components/sellers/seller-benefits";
import { FoundersPackage } from "@/components/sellers/founders-package";
import { SellerFaq } from "@/components/sellers/seller-faq";
import { SellerCatalog } from "@/components/sellers/seller-catalog";
import { SellerHero } from "@/components/sellers/seller-hero";
import { SellerSteps } from "@/components/sellers/seller-steps";
import { SellerTapes } from "@/components/sellers/seller-tapes";
import { SellerTrustTiers } from "@/components/sellers/seller-trust-tiers";
import type { FoundersProgram } from "@/lib/launch";
import type { SellerViewer } from "@/lib/seller-cta";

/**
 * /vender, end to end.
 *
 * `founders` is the promotion's status, read per request by the page: while it
 * is open the page makes the founders offer with its counter (no number when
 * there is no count to trust); once it closes or fills, the offer leaves.
 */
export function SellerProgram({
  founders,
  viewer = "signed-out",
  isFounder = false,
}: {
  founders: FoundersProgram;
  /** Who is looking: decides where every create-store CTA leads. */
  viewer?: SellerViewer;
  /** A signed-in owner of a founding store: sees that instead of the counter. */
  isFounder?: boolean;
}) {
  const promoActive = founders.open;
  const spotsTaken = founders.taken;

  return (
    <>
      <SellerHero isFounder={isFounder} promoActive={promoActive} spotsTaken={spotsTaken} viewer={viewer} />
      <SellerTapes promoActive={promoActive} />
      {promoActive ? <FoundersPackage /> : null}
      <SellerBenefits />
      <SellerCatalog />
      <SellerSteps />
      <SellerTrustTiers />
      <SellerFaq promoActive={promoActive} />
      {promoActive ? <FoundersCta spotsTaken={spotsTaken} /> : null}
    </>
  );
}
