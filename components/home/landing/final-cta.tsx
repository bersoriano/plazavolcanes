import Link from "next/link";

import { Accent, PrimaryCta, VolcanoLines } from "@/components/home/landing/primitives";

/**
 * The closing call on lime, straight above the footer. Left-aligned on a
 * phone, centred from lg.
 */
export function FinalCta() {
  return (
    <section
      aria-labelledby="fundadoras-heading"
      data-closing-band
      className="relative overflow-hidden bg-accent px-5 pb-16 pt-[60px] text-brand sm:px-8 lg:pb-24 lg:pt-[88px]"
    >
      <VolcanoLines className="pointer-events-none absolute inset-x-0 bottom-0 h-[140px] w-full text-brand/12 lg:h-[300px]" />

      <div className="relative mx-auto flex max-w-[1280px] flex-col gap-5 lg:items-center lg:gap-7 lg:text-center">
        <p className="text-[12px] font-bold tracking-[0.14em] lg:text-[13px]">ÚLTIMOS LUGARES FUNDADORES</p>
        <h2
          className="font-display text-[clamp(54px,35.4px+4.762vw,104px)] font-semibold leading-[0.95] tracking-[-0.044em] text-ink"
          id="fundadoras-heading"
        >
          Sé de las primeras <Accent>100 tiendas.</Accent>
        </h2>
        <p className="max-w-[620px] text-[17px] font-medium leading-[1.5] lg:text-[20px]">
          Publica gratis y vende sin comisión. Tu cliente te paga directo y todo queda por escrito.
        </p>
        <div className="mt-1 flex flex-col gap-2.5 sm:flex-row sm:gap-3.5 lg:mt-1.5">
          <PrimaryCta block href="/registro?vender=1">
            Abrir mi tienda gratis
          </PrimaryCta>
          <Link
            className="inline-flex h-[58px] items-center justify-center rounded-full bg-surface px-[30px] text-[17px] font-semibold text-brand transition-colors hover:bg-background lg:h-16 lg:text-[19px]"
            href="#pasos"
          >
            Conoce cómo funciona
          </Link>
        </div>
        <p className="mt-1 text-[14px] font-semibold lg:mt-2.5 lg:text-[16px]">
          Plaza Volcanes es una plataforma 100% mexicana 🇲🇽
        </p>
      </div>
    </section>
  );
}
