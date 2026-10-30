import type { Metadata } from "next";

import { BuyerSteps } from "@/components/home/buyer-steps";
import { TrustStrip } from "@/components/home/trust-strip";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema, sellerServiceSchema } from "@/lib/seo/organization";

export const metadata: Metadata = {
  title: "Cómo comprar",
  description:
    "Cómo comprar en Plaza Volcanes: explora sin cuenta, envía tu solicitud de pedido y acuerda pago y entrega directamente con cada tienda.",
  alternates: { canonical: "/como-comprar" },
};

/**
 * The buyer's guide that used to close the home page: the steps, then what
 * to check before agreeing a purchase. Browsing by state stays with the
 * catalogue at /explorar, since it filters published products.
 *
 * The page stays static, so its structured data leaves out the founders
 * offer, whose seats are only known per request.
 */
export default function HowToBuyPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [organizationSchema(), sellerServiceSchema({ foundersOpen: false })],
        }}
      />
      <BuyerSteps catalogHref="/explorar" headingLevel={1} />
      <TrustStrip />
    </>
  );
}
