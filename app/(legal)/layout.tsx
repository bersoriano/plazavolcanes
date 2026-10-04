import { pageContainer } from "@/components/layout/container";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${pageContainer} py-12 sm:py-16 print:px-0 print:py-0`}>
      {children}
    </div>
  );
}
