import type { Metadata } from "next";

import { SellerProgram } from "@/components/sellers/seller-program";

export const metadata: Metadata = {
  title: "Vender",
  description:
    "Abre tu tienda en Plaza Volcanes, publica tus productos y acuerda pago y entrega directamente con cada persona compradora.",
  // Every seller entry point tags itself with ?desde=, and each tag would
  // otherwise read as a separate page. The page itself ignores the parameter.
  alternates: { canonical: "/vender" },
};

export default function SellerPage() {
  return <SellerProgram />;
}
