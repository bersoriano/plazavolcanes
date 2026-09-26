import type { Metadata } from "next";

import { BuyerSteps } from "@/components/home/buyer-steps";
import { TrustStrip } from "@/components/home/trust-strip";

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
 */
export default function HowToBuyPage() {
  return (
    <>
      <BuyerSteps catalogHref="/explorar" headingLevel={1} />
      <TrustStrip />
    </>
  );
}
