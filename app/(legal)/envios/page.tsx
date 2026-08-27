import { LegalRoutePage, buildLegalMetadata } from "@/app/(legal)/legal-route";

export const generateMetadata = () => buildLegalMetadata("shipping_policy");

export default function Page() {
  return <LegalRoutePage type="shipping_policy" />;
}
