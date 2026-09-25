import type { ReactNode } from "react";

import { VolcanoMark } from "@/components/brand/volcano-mark";

type StatementBandProps = {
  /** The heading's id; the section is named after it. */
  headingId: string;
  /** The sentence, with its closing phrase in an `<em>`. */
  children: ReactNode;
  className?: string;
};

/**
 * One sentence on a lime band, centered, in the display face at
 * section-heading size, over a faint volcano mark.
 */
export function StatementBand({ headingId, children, className = "" }: StatementBandProps) {
  return (
    <section
      aria-labelledby={headingId}
      className={`relative overflow-hidden bg-accent px-5 py-10 sm:px-8 lg:py-[68px] ${className}`}
    >
      <VolcanoMark
        className="pointer-events-none absolute -bottom-3 left-1/2 h-[100px] w-[380px] max-w-none -translate-x-1/2 text-brand opacity-[0.08] lg:-bottom-8 lg:h-[220px] lg:w-[830px]"
        strokeWidth={4}
      />
      <h2
        className="relative mx-auto max-w-[1200px] text-balance text-center font-display text-[24px] font-medium leading-[1.02] tracking-[-0.03em] text-brand-hover sm:text-[36px] lg:text-[60px]"
        id={headingId}
      >
        {children}
      </h2>
    </section>
  );
}
