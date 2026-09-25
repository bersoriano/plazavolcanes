import { VolcanoMark } from "@/components/brand/volcano-mark";

/**
 * The home page's closing statement: one sentence on a lime band, just
 * above the purple footer, in the display face at section-heading size.
 */
export function MadeInMexico() {
  return (
    <section
      aria-labelledby="mexicana-heading"
      className="relative overflow-hidden bg-accent px-5 py-10 sm:px-8 lg:py-[68px]"
    >
      <VolcanoMark
        className="pointer-events-none absolute -bottom-3 left-1/2 h-[100px] w-[380px] max-w-none -translate-x-1/2 text-brand opacity-[0.08] lg:-bottom-8 lg:h-[220px] lg:w-[830px]"
        strokeWidth={4}
      />
      <h2
        className="relative mx-auto max-w-[1200px] text-balance text-center font-display text-[24px] font-medium leading-[1.02] tracking-[-0.03em] text-brand-hover sm:text-[36px] lg:text-[60px]"
        id="mexicana-heading"
      >
        Plaza Volcanes es una plataforma <em className="italic text-brand">100% Mexicana.</em>
      </h2>
    </section>
  );
}
