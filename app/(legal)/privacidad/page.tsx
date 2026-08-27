import { LegalRoutePage, buildLegalMetadata } from "@/app/(legal)/legal-route";

export const generateMetadata = () => buildLegalMetadata("privacy_notice");

export default function Page() {
  return <LegalRoutePage type="privacy_notice" />;
}
