import { LegalRoutePage, buildLegalMetadata } from "@/app/(legal)/legal-route";

export const generateMetadata = () => buildLegalMetadata("security_guidance");

export default function Page() {
  return <LegalRoutePage type="security_guidance" />;
}
