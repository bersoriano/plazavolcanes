import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { FOUNDERS_CAP, REPUTATION_IMPORT_AVAILABLE } from "@/lib/launch";

/** The same three promises /vender leads with, in the same order. */
const PROMISES = [
  "Sin retenciones ni comisiones",
  REPUTATION_IMPORT_AVAILABLE ? "Transfiere tu reputación" : "Transfiere tu reputación (pronto)",
  "Tu catálogo en un solo lugar",
];

/** The receipt's own summary, for anyone who never sees the picture. */
const RECEIPT_SUMMARY =
  "Ejemplo: vendes un artículo en $1,999.00 y recibes $1,999.00; Plaza Volcanes no cobra comisión ni retiene tu pago.";

function ReceiptLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}

/** The `$0.00` receipt from /vender, trimmed to its sums on a phone. */
function Receipt() {
  return (
    <div className="flex -rotate-2 flex-col gap-3 rounded-[1.125rem] bg-surface p-[18px] text-ink shadow-[0_30px_60px_-28px] shadow-black/60 lg:w-[360px] lg:gap-3.5 lg:rounded-[1.375rem] lg:p-6 lg:shadow-[0_40px_80px_-32px]">
      <div className="hidden items-center gap-3 lg:flex">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-trust-tier-fill text-success">
          <Check className="size-[18px]" strokeWidth={2.4} />
        </span>
        <span className="flex flex-col gap-px">
          <span className="text-[14px] font-bold">Pedido confirmado</span>
          <span className="text-[12px] text-muted">Tu tienda · Pago directo</span>
        </span>
      </div>
      <div className="flex flex-col gap-2 border-b-[1.5px] border-dashed border-line pb-3 text-[14px] tabular-nums lg:gap-[9px] lg:border-t lg:border-t-line/60 lg:py-3.5">
        <ReceiptLine label="Precio de venta">
          <span className="font-semibold">$1,999.00</span>
        </ReceiptLine>
        <ReceiptLine label="Comisión Plaza Volcanes">
          <span className="font-bold text-success">$0.00</span>
        </ReceiptLine>
        <ReceiptLine label="Retención">
          <span className="font-bold text-success">$0.00</span>
        </ReceiptLine>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-[14px] font-bold">Tú recibes</span>
        <span className="font-display text-[28px] font-bold leading-none tracking-[-0.03em] text-brand tabular-nums lg:text-[32px]">
          $1,999.00
        </span>
      </div>
    </div>
  );
}

export function SellerPitch() {
  return (
    <section aria-labelledby="vender-heading" className="px-4 pb-16 sm:px-8 lg:pb-[104px]">
      {/* One grid for both shapes: on a phone everything stacks and the
          receipt sits between the promises and the buttons; at lg the copy
          takes seven columns and the receipt the last four. */}
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-[18px] overflow-hidden rounded-[1.75rem] bg-brand px-[22px] pb-[26px] pt-8 text-white lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-6 lg:gap-y-5 lg:rounded-[2.25rem] lg:px-[72px] lg:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[200px] -top-[220px] size-[480px] rounded-full bg-radial-[closest-side] from-accent/18 to-accent/0 lg:-right-[160px] lg:-top-[300px] lg:size-[700px]"
        />
        <VolcanoMark
          className="pointer-events-none absolute -left-[160px] bottom-[120px] h-[149px] w-[560px] max-w-none text-accent opacity-10 lg:-bottom-[50px] lg:-left-20 lg:h-[239px] lg:w-[900px]"
          strokeWidth={4}
        />

        <p className="relative text-[12px] font-bold uppercase tracking-[0.18em] text-accent lg:col-span-7 lg:col-start-1 lg:text-[13px]">
          Para quien vende
        </p>
        <h2
          className="relative font-display text-[38px] font-medium leading-[1.02] tracking-[-0.035em] lg:col-span-7 lg:col-start-1 lg:text-[56px]"
          id="vender-heading"
        >
          Vende en <em className="italic text-accent">Plaza Volcanes.</em>
        </h2>
        <p className="relative max-w-[560px] text-pretty text-[16px] leading-[1.6] text-white/80 lg:col-span-7 lg:col-start-1 lg:text-[18px]">
          Las primeras {FOUNDERS_CAP} tiendas que se registren durante los primeros tres meses
          pueden publicar gratis y no pagan comisión por cada artículo vendido.
        </p>
        <ul className="relative flex flex-col gap-2.5 lg:col-span-7 lg:col-start-1 lg:mt-1 lg:flex-row lg:flex-wrap lg:gap-x-6 lg:gap-y-3">
          {PROMISES.map((promise) => (
            <li
              className="flex items-center gap-2.5 text-[15px] font-semibold text-white/92 lg:gap-2 lg:text-[14px]"
              key={promise}
            >
              <span
                aria-hidden="true"
                className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent text-brand-hover"
              >
                <Check className="size-[13px]" strokeWidth={3} />
              </span>
              {promise}
            </li>
          ))}
        </ul>

        <div className="relative mx-1.5 mb-1 mt-2 lg:col-span-4 lg:col-start-9 lg:row-span-5 lg:row-start-1 lg:m-0 lg:flex lg:justify-end">
          <p className="sr-only">{RECEIPT_SUMMARY}</p>
          <div aria-hidden="true" data-testid="seller-pitch-receipt">
            <Receipt />
          </div>
        </div>

        <div className="relative mt-1.5 flex flex-col gap-2.5 lg:col-span-7 lg:col-start-1 lg:mt-2 lg:flex-row lg:items-center lg:gap-3.5">
          <Link
            className="flex h-14 items-center justify-center gap-2.5 rounded-full bg-accent text-[17px] font-bold text-brand-hover lg:px-7"
            href="/registro?vender=1"
          >
            Crear mi tienda gratis
            <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </Link>
          <Link
            className="flex h-14 items-center justify-center rounded-full border border-white/30 text-[17px] font-semibold text-white transition-colors hover:border-accent hover:text-accent lg:px-6"
            href="/vender?desde=pitch"
          >
            Conoce cómo funciona
          </Link>
        </div>
      </div>
    </section>
  );
}
