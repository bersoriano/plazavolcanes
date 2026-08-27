import type { Metadata } from "next";

import { SellerProgram } from "@/components/sellers/seller-program";

export const metadata: Metadata = {
  title: "Vender",
  description:
    "Abre tu tienda en Plaza Volcanes, publica tus productos y acuerda pago y entrega directamente con cada persona compradora.",
};

export default function SellerPage() {
  return <SellerProgram />;
}
