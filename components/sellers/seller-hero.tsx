import Link from "next/link";
import { ArrowRight, Check, ImageIcon, ShieldCheck, Star } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { FOUNDERS_CAP, REPUTATION_IMPORT_AVAILABLE, resolveFoundersProgress } from "@/lib/launch";

const CHECKLIST = [
  "Sin retenciones ni comisiones",
  REPUTATION_IMPORT_AVAILABLE ? "Transfiere tu reputación" : "Transfiere tu reputación (pronto)",
  "Tu catálogo en un solo lugar",
];

/** The receipt's own summary, for anyone who never sees the picture. */
const RECEIPT_SUMMARY =
  "Ejemplo: vendes un artículo en $1,999.00 y recibes $1,999.00; Plaza Volcanes no cobra comisión ni retiene tu pago.";

function ReceiptLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}

export function SellerHero({ spotsTaken }: { spotsTaken?: number | null }) {
  const progress = resolveFoundersProgress(spotsTaken);

  return (
    <section
      aria-labelledby="vender-heading"
      className="relative overflow-hidden bg-brand px-5 pb-12 pt-9 text-white sm:px-8 lg:pb-[120px] lg:pt-[88px]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[220px] -top-[200px] size-[520px] rounded-full bg-radial-[closest-side] from-accent/20 to-accent/0 lg:-right-[180px] lg:-top-[260px] lg:size-[820px]"
      />
      <VolcanoMark
        className="pointer-events-none absolute -bottom-[30px] -left-[120px] h-[170px] w-[640px] max-w-none text-accent opacity-10 lg:-bottom-[60px] lg:-left-10 lg:h-[404px] lg:w-[1520px] lg:opacity-[0.09]"
        strokeWidth={4}
      />
      {/* Grain, not texture for its own sake: a flat aubergine this large bands
          on 8-bit displays, and the noise breaks the banding up. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full opacity-[0.16] mix-blend-overlay"
      >
        <filter id="vender-hero-grain">
          <feTurbulence baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" type="fractalNoise" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect filter="url(#vender-hero-grain)" height="100%" width="100%" />
      </svg>

      <div className="relative mx-auto grid max-w-[1200px] gap-[22px] lg:grid-cols-12 lg:items-center lg:gap-x-6">
        <div className="flex flex-col items-start gap-[22px] lg:col-span-7 lg:gap-7">
          <p className="flex items-center gap-2 rounded-full border border-accent/45 bg-accent/10 py-[7px] pl-[10px] pr-[14px] text-[11px] font-bold uppercase tracking-[0.08em] text-accent lg:gap-2.5 lg:py-2 lg:pl-3 lg:pr-4 lg:text-[13px]">
            <span
              aria-hidden="true"
              className="size-[7px] shrink-0 rounded-full bg-accent shadow-[0_0_0_3px] shadow-accent/20 lg:size-2 lg:shadow-[0_0_0_4px]"
            />
            {progress ? (
              <>
                Lanzamiento · Quedan {progress.left}
                {/* The phone pill has no room for the cap, and the sentence has
                    to stay a sentence at both widths, not two spliced halves. */}
                <span className="hidden lg:inline"> de {FOUNDERS_CAP}</span> lugares
              </>
            ) : (
              <>Lanzamiento · Primeras {FOUNDERS_CAP} tiendas</>
            )}
          </p>

          <h1
            className="text-balance font-display text-[46px] font-medium leading-[1] tracking-[-0.035em] text-white lg:text-[84px] lg:leading-[0.98]"
            id="vender-heading"
          >
            Abre tu tienda gratis y quédate con <em className="italic text-accent">cada peso.</em>
          </h1>

          <p className="max-w-[580px] text-pretty text-[17px] leading-[1.55] text-white/80 lg:text-[20px]">
            Publica tu catálogo, trae la reputación que ya ganaste en otras plataformas y cobra
            directo a tus clientes. Sin retenciones ni comisiones.
          </p>

          <div className="flex flex-col items-center gap-4 self-stretch lg:mt-1 lg:flex-row lg:gap-7 lg:self-auto">
            <Link
              className="flex h-[58px] items-center justify-center gap-2.5 self-stretch rounded-full bg-accent text-[18px] font-bold text-brand-hover shadow-[0_12px_32px_-12px] shadow-accent/65 lg:h-[60px] lg:self-auto lg:px-[30px]"
              href="/registro?vender=1"
            >
              Crear mi tienda gratis
              <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.2} />
            </Link>
            <a
              className="tap inline-flex items-center text-[16px] font-semibold text-white underline decoration-accent/70 decoration-2 underline-offset-[6px] lg:text-[17px]"
              href="#como-empezar"
            >
              Ver cómo funciona
            </a>
          </div>

          <ul className="flex flex-col gap-3 self-stretch border-t border-white/15 pt-5 lg:mt-4 lg:flex-row lg:flex-wrap lg:gap-x-6 lg:gap-y-3.5 lg:pt-7">
            {CHECKLIST.map((item) => (
              <li
                className="flex items-center gap-2.5 text-[15px] font-semibold text-white/90 lg:gap-2 lg:text-[14px]"
                key={item}
              >
                <span
                  aria-hidden="true"
                  className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent text-brand-hover"
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-2 lg:col-span-5 lg:mt-0">
          <p className="sr-only">{RECEIPT_SUMMARY}</p>
          <div aria-hidden="true" className="relative h-[604px] lg:h-[650px]">
            <div className="absolute left-1 top-[184px] flex w-[338px] max-w-full -rotate-2 flex-col gap-4 rounded-[1.375rem] bg-surface p-[22px] text-ink shadow-[0_40px_80px_-32px_rgba(0,0,0,0.6)] lg:left-0 lg:top-[164px] lg:w-[424px] lg:gap-[18px] lg:rounded-[1.5rem] lg:p-7">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-trust-tier-fill text-success lg:size-[38px]">
                  <Check className="size-[18px] lg:size-5" strokeWidth={2.4} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold">Pedido confirmado</span>
                  <span className="text-[13px] text-muted">Tu tienda · Pago directo</span>
                </span>
              </div>

              <div className="flex items-center gap-3 border-y border-line/60 py-3.5 lg:gap-3.5 lg:py-4">
                <span className="grid size-[52px] shrink-0 place-items-center rounded-xl bg-photo-backdrop text-muted/70 lg:size-[60px] lg:rounded-[0.875rem]">
                  <ImageIcon className="size-[22px] lg:size-6" strokeWidth={1.6} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-display text-[17px] font-bold lg:text-[18px]">
                    Micrófono Rode
                  </span>
                  <span className="text-[13px] text-muted">Usado · Buen estado</span>
                </span>
              </div>

              <div className="flex flex-col gap-2.5 text-[14px] tabular-nums lg:gap-3 lg:text-[15px]">
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

              <div className="flex items-end justify-between border-t-[1.5px] border-dashed border-line pt-3.5 lg:pt-4">
                <span className="text-[14px] font-bold lg:text-[15px]">Tú recibes</span>
                <span className="flex items-baseline gap-[5px] lg:gap-1.5">
                  <span className="font-display text-[32px] font-bold leading-none tracking-[-0.03em] text-brand tabular-nums lg:text-[40px]">
                    $1,999.00
                  </span>
                  <span className="text-[12px] font-semibold text-muted lg:text-[13px]">MXN</span>
                </span>
              </div>

              {/* 6px, not the mockup's 8: at 390px the line clears by a hair,
                  and two pixels of gap are the difference between one line and
                  two. Below 390 the card narrows and the text wraps anyway. */}
              <div className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-[11px] text-[13px] font-bold text-brand-hover lg:gap-2.5 lg:px-3.5 lg:py-3 lg:text-[14px]">
                <ShieldCheck className="size-4 shrink-0 lg:size-[18px]" strokeWidth={2} />
                El 100% de tu venta, directo de tu cliente
              </div>
            </div>

            {REPUTATION_IMPORT_AVAILABLE ? (
              <div className="absolute -right-0.5 top-0 flex w-[218px] rotate-4 flex-col gap-[9px] rounded-[1.125rem] bg-accent p-4 text-brand-hover shadow-[0_26px_50px_-24px_rgba(0,0,0,0.55)] lg:-right-7 lg:w-[272px] lg:gap-3 lg:rounded-[1.25rem] lg:p-5">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] lg:text-[11px]">
                  Reputación importada
                </span>
                <span className="flex gap-0.5 text-brand lg:gap-[3px]">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star className="size-[15px] lg:size-[18px]" fill="currentColor" key={index} strokeWidth={0} />
                  ))}
                </span>
                <span className="font-display text-[18px] font-bold leading-[1.1] tracking-[-0.02em] lg:text-[21px]">
                  Tu historial viaja contigo
                </span>
                <span className="flex flex-col gap-1.5">
                  <span className="flex items-center justify-between rounded-[0.5625rem] bg-white/60 px-2.5 py-2 text-[13px] font-semibold lg:rounded-[0.625rem] lg:px-3 lg:py-[9px] lg:text-[14px]">
                    Mercado Libre
                    <Check className="size-[15px] lg:size-4" strokeWidth={2.6} />
                  </span>
                  <span className="hidden items-center justify-between rounded-[0.625rem] bg-white/60 px-3 py-[9px] text-[14px] font-semibold lg:flex">
                    Facebook Marketplace
                    <Check className="size-4" strokeWidth={2.6} />
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
