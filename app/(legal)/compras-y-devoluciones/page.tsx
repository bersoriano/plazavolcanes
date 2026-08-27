import { LegalRoutePage, buildLegalMetadata } from "@/app/(legal)/legal-route";

export const generateMetadata = () => buildLegalMetadata("returns_policy");

export default function Page() {
  return <LegalRoutePage type="returns_policy" />;
}
