import { FoundersCta } from "@/components/sellers/founders-cta";
import { SellerBenefits } from "@/components/sellers/seller-benefits";
import { SellerFaq } from "@/components/sellers/seller-faq";
import { SellerHero } from "@/components/sellers/seller-hero";
import { SellerSteps } from "@/components/sellers/seller-steps";
import { SellerTrustTiers } from "@/components/sellers/seller-trust-tiers";
import type { FoundersProgram } from "@/lib/launch";

/**
 * /vender, end to end.
 *
 * `founders` is the promotion's status, read per request by the page: while it
 * is open the page makes the founders offer with its counter (no number when
 * there is no count to trust); once it closes or fills, the offer leaves.
 */
export function SellerProgram({ founders }: { founders: FoundersProgram }) {
  const promoActive = founders.open;
  const spotsTaken = founders.taken;

  return (
    <>
      <SellerHero promoActive={promoActive} spotsTaken={spotsTaken} />
      <SellerBenefits promoActive={promoActive} />
      <SellerSteps />
      <SellerTrustTiers />
      <SellerFaq promoActive={promoActive} />
      {promoActive ? <FoundersCta spotsTaken={spotsTaken} /> : null}
    </>
  );
}
