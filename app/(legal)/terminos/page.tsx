import { LegalRoutePage, buildLegalMetadata } from "@/app/(legal)/legal-route";

export const generateMetadata = () => buildLegalMetadata("platform_terms");

export default function Page() {
  return <LegalRoutePage type="platform_terms" />;
}
