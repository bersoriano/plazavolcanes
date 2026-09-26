import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Accent, VolcanoLines } from "@/components/home/landing/primitives";
import { FOUNDER_EARN_RULE, FOUNDER_MIN_LIVE_ITEMS, FOUNDER_OFFER, FOUNDERS_CAP, resolveFoundersProgress } from "@/lib/launch";
import { OWNER_CTA_LABEL, sellerCtaHref, type SellerViewer } from "@/lib/seller-cta";

/**
 * The closing call on /vender: a plum card with the offer on the left and,
 * on the right, the spots left and the CTA. Without a trustworthy count the
 * box keeps the CTA and drops the number and the bar. Only rendered while the
 * promotion is open. `data-final-cta` lets the phone's sticky bar step aside
 * once this is on screen.
 */
export function FoundersCta({
  spotsTaken,
  viewer = "signed-out",
}: {
  spotsTaken?: number | null;
  viewer?: SellerViewer;
}) {
  const progress = resolveFoundersProgress(spotsTaken);

  return (
    <section aria-labelledby="fundadoras-heading" className="px-3 pb-12 pt-6 sm:px-8 lg:pb-20 lg:pt-10 xl:px-20" data-final-cta>
      <div className="relative mx-auto flex max-w-[1280px] flex-col gap-6 overflow-hidden rounded-[32px] bg-brand px-[22px] pb-7 pt-9 text-white lg:flex-row lg:items-center lg:justify-between lg:gap-14 lg:rounded-[40px] lg:p-16">
        <VolcanoLines className="pointer-events-none absolute inset-x-0 bottom-0 h-[160px] w-full text-accent opacity-10 lg:h-[280px]" />

        <div className="relative flex flex-col gap-[18px] lg:max-w-[640px] lg:gap-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent lg:text-[13px]">Tiendas fundadoras</p>
          <h2
            className="font-display text-[clamp(46px,35.3px+2.476vw,72px)] font-semibold leading-[0.98] tracking-[-0.039em]"
            id="fundadoras-heading"
          >
            Sé una de las primeras <Accent className="text-accent">{FOUNDERS_CAP} tiendas.</Accent>
          </h2>
          <p className="text-[16px] leading-[1.55] text-white/80 lg:text-[18px]">
            {FOUNDER_OFFER} {FOUNDER_EARN_RULE} Los lugares se asignan en el orden en que las tiendas llegan a {FOUNDER_MIN_LIVE_ITEMS}
            productos.
          </p>
        </div>

        <div className="relative flex flex-col gap-4 rounded-[24px] border border-white/15 bg-white/5 p-5 lg:w-[400px] lg:shrink-0 lg:rounded-[28px] lg:p-7">
          {progress ? (
            <>
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-display text-[32px] font-bold tracking-[-0.035em] text-accent tabular-nums lg:text-[44px]">
                  {progress.left}
                </span>
                <span className="text-[14px] font-semibold text-white/80 lg:text-[15px]">
                  de {FOUNDERS_CAP} lugares libres
                </span>
              </p>
              <div
                aria-label="Lugares de tiendas fundadoras ocupados"
                aria-valuemax={FOUNDERS_CAP}
                aria-valuemin={0}
                aria-valuenow={progress.taken}
                className="h-3 overflow-hidden rounded-full bg-white/15"
                role="progressbar"
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${progress.percent}%` }} />
              </div>
            </>
          ) : null}
          <Link
            className="mt-1.5 flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-accent text-[17px] font-bold text-brand lg:h-[60px] lg:text-[18px]"
            href={sellerCtaHref(viewer, "final")}
          >
            {viewer === "owner" ? OWNER_CTA_LABEL : "Crear mi tienda gratis"}
            <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </Link>
          {viewer === "signed-out" ? (
            <Link
              className="tap inline-flex items-center justify-center self-center text-[15px] font-semibold text-white underline decoration-accent underline-offset-4"
              href="/ingresar?intent=vender"
            >
              ¿Ya tienes cuenta? Ingresa
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
