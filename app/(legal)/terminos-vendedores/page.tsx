import { LegalRoutePage, buildLegalMetadata } from "@/app/(legal)/legal-route";

export const generateMetadata = () => buildLegalMetadata("seller_terms");

export default function Page() {
  return <LegalRoutePage type="seller_terms" />;
}
