import { VolcanoMark } from "@/components/brand/volcano-mark";
import { Card } from "@/components/ui/card";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden px-5 py-14 sm:px-8 sm:py-20">
      <VolcanoMark className="pointer-events-none absolute -left-36 top-10 w-[620px] text-brand/6" />
      <Card padding="md" className="relative mx-auto max-w-md shadow-[0_22px_70px_rgba(50,23,77,0.1)] sm:p-9">
        {children}
      </Card>
    </section>
  );
}
