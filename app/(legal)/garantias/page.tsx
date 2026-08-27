import { LegalRoutePage, buildLegalMetadata } from "@/app/(legal)/legal-route";

export const generateMetadata = () => buildLegalMetadata("warranty_policy");

export default function Page() {
  return <LegalRoutePage type="warranty_policy" />;
}
