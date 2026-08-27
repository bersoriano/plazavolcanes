import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";

export function SellerPitch() {
  return (
    <section
      aria-labelledby="vender-heading"
      className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-12 lg:px-12"
    >
      <div className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-8 text-white sm:px-10 sm:py-10 lg:px-12">
        <VolcanoMark className="pointer-events-none absolute -bottom-20 right-0 w-[520px] max-w-none text-accent/15" />
        <div className="relative max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Para quien vende
          </p>
          <h2
            className="mt-2 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-4xl"
            id="vender-heading"
          >
            Vende en Plaza Volcanes
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/80">
            Abre tu tienda, publica tus productos y recibe solicitudes sin comisiones.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-7 font-semibold text-brand-hover"
              href="/registro"
            >
              Abrir mi tienda
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              className="inline-flex min-h-12 items-center rounded-full border border-white/30 px-6 font-semibold text-white hover:border-accent hover:text-accent"
              href="/vender"
            >
              Conoce cómo funciona
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
