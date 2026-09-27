import type { Metadata } from "next";

import { SellerProgram } from "@/components/sellers/seller-program";
import { getCurrentUserAdminStatus } from "@/lib/admin-auth.server";
import { getFoundersProgram, viewerIsFounder } from "@/lib/queries/founders.server";
import { viewerOwnsAnyShop } from "@/lib/queries/seller-standing.server";
import { sellerViewer } from "@/lib/seller-cta";

import "./vender.css";

export const metadata: Metadata = {
  title: "Vender",
  description:
    "Abre tu tienda en Plaza Volcanes, publica tus productos y acuerda pago y entrega directamente con cada persona compradora.",
  // Every seller entry point tags itself with ?desde=, and each tag would
  // otherwise read as a separate page. The page itself ignores the parameter.
  alternates: { canonical: "/vender" },
};

export default async function SellerPage() {
  const [founders, { signedIn }, ownsShop, isFounder] = await Promise.all([
    getFoundersProgram(),
    getCurrentUserAdminStatus(),
    viewerOwnsAnyShop(),
    viewerIsFounder(),
  ]);

  return <SellerProgram founders={founders} isFounder={isFounder} viewer={sellerViewer(signedIn, ownsShop)} />;
}
