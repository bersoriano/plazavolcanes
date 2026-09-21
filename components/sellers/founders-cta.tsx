import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { FOUNDERS_CAP, resolveFoundersProgress } from "@/lib/launch";

export function FoundersCta({ spotsTaken }: { spotsTaken?: number | null }) {
  const progress = resolveFoundersProgress(spotsTaken);

  return (
    <section aria-labelledby="fundadoras-heading" className="px-5 pb-16 sm:px-8 lg:pb-[120px]">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[1.75rem] bg-brand px-6 pb-7 pt-9 text-white lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-6 lg:rounded-[2.25rem] lg:px-20 lg:py-[72px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[260px] -left-[160px] size-[520px] rounded-full bg-radial-[closest-side] from-accent/20 to-accent/0 lg:-bottom-[380px] lg:-left-[200px] lg:size-[720px]"
        />
        <VolcanoMark
          className="pointer-events-none absolute -right-[160px] top-[150px] h-[138px] w-[520px] max-w-none text-accent opacity-10 lg:-bottom-10 lg:-right-20 lg:top-auto lg:h-[239px] lg:w-[900px]"
          strokeWidth={5}
        />

        <div className="relative flex flex-col gap-[18px] lg:col-span-7 lg:gap-5">
          <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-accent lg:text-[13px]">
            Tiendas fundadoras
          </span>
          <h2
            className="text-balance font-display text-[42px] font-medium leading-none tracking-[-0.035em] lg:text-[64px]"
            id="fundadoras-heading"
          >
            Sé una de las primeras{" "}
            <em className="italic text-accent">{FOUNDERS_CAP} tiendas.</em>
          </h2>
          <p className="max-w-[520px] text-[16px] leading-[1.6] text-white/80 lg:text-[18px]">
            Publica gratis y no pagues comisión por cada artículo vendido. Los lugares se asignan por
            orden de registro.
          </p>
        </div>

        {/* On a phone the counter is its own card and the buttons sit below it;
            from lg the panel itself is the card and holds everything. */}
        <div className="relative mt-[18px] flex flex-col gap-3.5 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:gap-4 lg:rounded-[1.5rem] lg:border lg:border-white/15 lg:bg-white/5 lg:p-7">
          {progress ? (
            <div className="flex flex-col gap-3.5 rounded-[1.25rem] border border-white/15 bg-white/5 p-5 lg:gap-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
              <p className="flex items-baseline justify-between">
                <span className="text-[14px] font-semibold text-white/80">Lugares ocupados</span>
                <span className="font-display text-[26px] font-bold tracking-[-0.02em] tabular-nums lg:text-[30px]">
                  {progress.taken}
                  <span className="text-[16px] text-white/60 lg:text-[18px]">/{FOUNDERS_CAP}</span>
                </span>
              </p>
              <div
                aria-label="Lugares de tiendas fundadoras ocupados"
                aria-valuemax={FOUNDERS_CAP}
                aria-valuemin={0}
                aria-valuenow={progress.taken}
                className="h-2.5 overflow-hidden rounded-full bg-white/15 lg:h-3"
                role="progressbar"
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${progress.percent}%` }} />
              </div>
              <p className="text-[14px] leading-[1.5] text-white/80">
                Quedan {progress.left} lugares para tiendas fundadoras.
              </p>
            </div>
          ) : null}

          <Link
            className="flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-accent text-[18px] font-bold text-brand-hover lg:h-[60px]"
            href="/registro?vender=1"
          >
            Crear mi tienda gratis
            <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </Link>
          <Link
            className="tap inline-flex items-center justify-center self-center text-[15px] font-semibold text-white/85 underline decoration-accent/70 decoration-2 underline-offset-4"
            href="/ingresar?intent=vender"
          >
            ¿Ya tienes cuenta? Ingresa
          </Link>
        </div>
      </div>
    </section>
  );
}
