import { FoundersCta } from "@/components/sellers/founders-cta";
import { SellerBenefits } from "@/components/sellers/seller-benefits";
import { SellerFaq } from "@/components/sellers/seller-faq";
import { SellerHero } from "@/components/sellers/seller-hero";
import { SellerSteps } from "@/components/sellers/seller-steps";
import { SellerTrustTiers } from "@/components/sellers/seller-trust-tiers";
import { isFoundersPromoActive } from "@/lib/launch";

/**
 * /vender, end to end.
 *
 * `spotsTaken` is the founders counter, and there is deliberately nothing
 * feeding it yet: until the launch window and the qualifying rule are settled,
 * the hero pill and the progress card show no number at all rather than one
 * nobody can stand behind.
 */
export function SellerProgram({ spotsTaken }: { spotsTaken?: number | null }) {
  // Read per request, so the founders wording leaves the moment the promotion ends.
  const promoActive = isFoundersPromoActive();

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
