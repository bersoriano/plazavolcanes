import { LegalRoutePage, buildLegalMetadata } from "@/app/(legal)/legal-route";

export const generateMetadata = () => buildLegalMetadata("complaints_policy");

export default function Page() {
  return <LegalRoutePage type="complaints_policy" />;
}
