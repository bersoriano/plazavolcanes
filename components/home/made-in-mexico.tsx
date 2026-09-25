import { VolcanoMark } from "@/components/brand/volcano-mark";

/**
 * The home page's closing statement: one sentence on a lime band, just
 * above the purple footer, in the display face at poster size.
 */
export function MadeInMexico() {
  return (
    <section
      aria-labelledby="mexicana-heading"
      className="relative overflow-hidden bg-accent px-5 py-20 sm:px-8 lg:py-[136px]"
    >
      <VolcanoMark
        className="pointer-events-none absolute -bottom-6 left-1/2 h-[200px] w-[760px] max-w-none -translate-x-1/2 text-brand opacity-[0.08] lg:-bottom-16 lg:h-[440px] lg:w-[1660px]"
        strokeWidth={4}
      />
      <h2
        className="relative mx-auto max-w-[1200px] text-balance font-display text-[48px] font-medium leading-[0.95] tracking-[-0.04em] text-brand-hover sm:text-[72px] lg:text-[120px] lg:leading-[0.92]"
        id="mexicana-heading"
      >
        Plaza Volcanes es una plataforma <em className="italic text-brand">100% Mexicana.</em>
      </h2>
    </section>
  );
}
