import Link from "next/link";
import { ArrowRight, Check, Mic, Sparkle } from "lucide-react";

import { FoundersCounter } from "@/components/home/landing/founders-counter";
import { VolcanoLines } from "@/components/home/landing/primitives";
import { FounderSeal } from "@/components/sellers/founder-seal";
import { BASE_LISTING_LIMIT, FOUNDER_EARN_RULE, FOUNDERS_CAP, REPUTATION_IMPORT_AVAILABLE } from "@/lib/launch";
import { OWNER_CTA_LABEL, sellerCtaHref, type SellerViewer } from "@/lib/seller-cta";

/** What every shop gets, shown once the founders offer is over. */
const CHECKLIST = [
  `${BASE_LISTING_LIMIT} productos gratis`,
  "Sin comisión en pago directo",
  REPUTATION_IMPORT_AVAILABLE ? "Muestra tu perfil de Mercado Libre y Facebook" : "Tu catálogo en un solo lugar",
];

/** The receipt's own summary, for anyone who never sees the picture. */
const RECEIPT_SUMMARY =
  "Ejemplo: vendes un artículo en $1,999.00 y recibes $1,999.00; en pago directo Plaza Volcanes no cobra comisión ni retiene tu pago.";

function ReceiptLine({
  label,
  children,
  className = "flex",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className} justify-between`}>
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}

const HERO_NOTE = `${FOUNDER_EARN_RULE} Registrarte no aparta un lugar: se gana publicando.`;

/**
 * The /vender hero on plum: the pitch, the CTA, the founders counter and a
 * collage of what a sale looks like.
 *
 * While the founders promotion is open the counter card replaces the old
 * checklist; once it closes or fills the checklist comes back and the pill
 * states what every shop keeps. A founder sees that they already are one in
 * place of the counter, and an owner's CTA leads to their panel.
 */
export function SellerHero({
  spotsTaken,
  promoActive = true,
  viewer = "signed-out",
  isFounder = false,
}: {
  spotsTaken?: number | null;
  promoActive?: boolean;
  viewer?: SellerViewer;
  isFounder?: boolean;
}) {
  const owner = viewer === "owner";

  return (
    <section
      aria-labelledby="vender-heading"
      className="relative overflow-hidden bg-brand bg-[radial-gradient(circle_at_90%_55%,rgb(122_78_168/0.55),transparent_50%)] px-5 pb-12 pt-7 text-white sm:px-8 lg:pb-20 lg:pt-[72px] xl:bg-[radial-gradient(circle_at_78%_30%,rgb(122_78_168/0.55),transparent_45%)] xl:px-20"
    >
      <VolcanoLines className="pointer-events-none absolute inset-x-0 bottom-0 h-[160px] w-full text-white opacity-[0.08] lg:h-[300px]" />

      <div className="relative mx-auto flex max-w-[1280px] flex-col gap-[22px] xl:grid xl:grid-cols-[minmax(0,700px)_560px] xl:justify-between xl:gap-10">
        <div className="flex flex-col items-start gap-[22px] lg:gap-7">
          <p className="flex h-8 items-center gap-2.5 rounded-full border-[1.5px] border-accent/50 bg-accent/10 px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent lg:h-[34px] lg:px-4 lg:text-[12px]">
            <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-accent shadow-[0_0_0_4px] shadow-accent/20" />
            {promoActive ? <>Lanzamiento · Primeras {FOUNDERS_CAP} tiendas</> : <>{BASE_LISTING_LIMIT} productos gratis · pago directo</>}
          </p>

          <h1
            className="font-display text-[clamp(48px,34.6px+3.429vw,84px)] font-semibold leading-[0.96] tracking-[-0.042em] text-white"
            id="vender-heading"
          >
            {/* Three lines on a wide screen so "peso." is never left alone. */}
            Abre tu tienda gratis <br className="hidden xl:inline" />y quédate con{" "}
            <br className="hidden xl:inline" />
            <em className="italic text-accent">cada peso.</em>
          </h1>

          <p className="max-w-[590px] text-pretty text-[17px] leading-[1.55] text-white/80 lg:text-[20px]">
            Publica {BASE_LISTING_LIMIT} productos gratis, muestra tu perfil de Mercado Libre o Facebook y cobra
            directo a tus clientes. Sin retenciones ni comisión en pago directo.
          </p>

          <div className="flex flex-col items-center gap-4 self-stretch sm:flex-row sm:gap-[22px] sm:self-auto">
            <Link
              className="flex h-[58px] items-center justify-between gap-4 self-stretch rounded-full bg-accent pl-6 pr-2 text-[17px] font-bold text-brand shadow-[0_16px_36px_-14px] shadow-accent/55 sm:self-auto lg:h-[62px] lg:pl-[30px] lg:pr-2.5 lg:text-[18px]"
              data-hero-cta
              href={sellerCtaHref(viewer, "hero")}
            >
              {owner ? OWNER_CTA_LABEL : "Crear mi tienda gratis"}
              <span aria-hidden="true" className="grid size-[42px] place-items-center rounded-full bg-brand text-accent lg:size-11">
                <ArrowRight className="size-5" strokeWidth={2.2} />
              </span>
            </Link>
            <a
              className="tap inline-flex items-center text-[16px] font-semibold text-white underline decoration-accent decoration-[3px] underline-offset-[6px] lg:text-[17px]"
              href="#pasos"
            >
              Ver cómo funciona
            </a>
          </div>

          {isFounder ? (
            <p className="flex w-full items-center gap-3 rounded-[20px] border border-white/15 bg-white/5 px-[18px] py-4 text-[15px] font-semibold sm:max-w-[560px] lg:rounded-[22px] lg:px-[22px]">
              <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-brand">
                <Check className="size-4" strokeWidth={3} />
              </span>
              Ya eres tienda fundadora
            </p>
          ) : promoActive ? (
            <FoundersCounter compactOnPhone note={HERO_NOTE} spotsTaken={spotsTaken} tone="dark" />
          ) : (
            <ul className="flex flex-col gap-3 self-stretch border-t border-white/15 pt-5 lg:flex-row lg:flex-wrap lg:gap-x-6 lg:gap-y-3.5 lg:pt-7">
              {CHECKLIST.map((item) => (
                <li className="flex items-center gap-2.5 text-[15px] font-semibold text-white/90 lg:gap-2 lg:text-[14px]" key={item}>
                  <span aria-hidden="true" className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent text-brand-hover">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <HeroCollage promoActive={promoActive} />
      </div>
    </section>
  );
}

/**
 * The receipt, the imported reputation and, while the promotion runs, the
 * founder seal and Premium chip. The phone composition is its own 350×400
 * arrangement; from sm the desktop one, 560×640. All of it is aria-hidden:
 * the summary above it carries the facts.
 */
function HeroCollage({ promoActive }: { promoActive: boolean }) {
  return (
    <div className="mx-auto mt-2 w-full max-w-[350px] sm:max-w-[560px] xl:mt-0">
      <p className="sr-only">{RECEIPT_SUMMARY}</p>
      <div aria-hidden="true" className="relative h-[400px] sm:h-[640px]">
        <div className="animate-rise-in absolute left-0 top-[60px] flex w-[310px] flex-col gap-2.5 rounded-[24px] leading-[1.2] bg-surface p-[18px] text-ink shadow-[0_30px_50px_-24px_rgb(0_0_0/0.6)] [animation-delay:80ms] sm:left-10 sm:top-[150px] sm:w-[400px] sm:gap-3.5 sm:rounded-[28px] sm:p-6 sm:shadow-[0_40px_70px_-30px_rgb(0_0_0/0.6)]">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-brand sm:size-10">
              <Check className="size-5" strokeWidth={2.6} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-bold sm:text-[16px]">Pedido confirmado</span>
              <span className="text-[13px] text-muted">
                <span className="sm:hidden">Micrófono Rode · Pago directo</span>
                <span className="hidden sm:inline">Tu tienda · Pago directo</span>
              </span>
            </span>
          </div>

          <div className="hidden items-center gap-3 rounded-2xl bg-background p-2.5 sm:flex">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-photo-backdrop text-brand">
              <Mic className="size-[22px]" strokeWidth={1.8} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-bold">Micrófono Rode</span>
              <span className="text-[12px] text-muted">Usado · Buen estado</span>
            </span>
          </div>

          <div className="flex flex-col gap-2 border-t border-hairline pt-2.5 text-[14px] tabular-nums sm:gap-3 sm:border-0 sm:pt-0">
            <ReceiptLine className="hidden sm:flex" label="Precio de venta">
              <span className="font-semibold">$1,999.00</span>
            </ReceiptLine>
            <ReceiptLine label="Comisión Plaza Volcanes">
              <span className="font-bold text-success">$0.00</span>
            </ReceiptLine>
            <ReceiptLine label="Retención">
              <span className="font-bold text-success">$0.00</span>
            </ReceiptLine>
          </div>

          <div className="flex items-baseline justify-between border-t border-hairline pt-3">
            <span className="text-[14px] font-bold sm:text-[15px]">Tú recibes</span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-[30px] font-bold leading-none tracking-[-0.03em] text-brand tabular-nums sm:text-[38px]">
                $1,999.00
              </span>
              <span className="hidden text-[14px] font-semibold text-muted sm:inline">MXN</span>
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-lime-tint px-3 py-2.5 text-[13px] font-bold text-brand">
            <Check className="hidden size-4 shrink-0 sm:block" strokeWidth={2.6} />
            El 100% de tu venta, directo de tu cliente
          </div>
        </div>

        {REPUTATION_IMPORT_AVAILABLE ? (
          <div className="animate-rise-in absolute left-[170px] top-0 flex w-[180px] rotate-5 flex-col gap-1 rounded-[18px] bg-accent px-3.5 py-3 text-brand shadow-[0_20px_36px_-18px_rgb(0_0_0/0.6)] [animation-delay:200ms] sm:left-[300px] sm:top-2.5 sm:w-[250px] sm:rotate-4 sm:gap-2.5 sm:rounded-[24px] sm:p-[18px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] sm:text-[11px]">Tu reputación, visible</span>
            <span className="font-display text-[17px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[22px]">
              Tus perfiles, en tu tienda
            </span>
            {["Mercado Libre", "Facebook Marketplace"].map((platform) => (
              <span className="hidden h-9 items-center justify-between rounded-[10px] bg-surface px-3 text-[13px] font-semibold sm:flex" key={platform}>
                {platform}
                <Check className="size-4" strokeWidth={2.6} />
              </span>
            ))}
          </div>
        ) : null}

        {promoActive ? (
          <>
            <FounderSeal className="animate-rise-in absolute left-[236px] top-[270px] size-28 border-[3px] text-[11px] [animation-delay:320ms] sm:-left-10 sm:top-[548px] sm:size-[150px] sm:border-4 sm:text-[13px]" />
            <span className="animate-rise-in absolute left-4 top-[352px] flex h-[38px] -rotate-3 items-center gap-1.5 rounded-full bg-premium-ink px-3.5 text-[13px] font-bold text-premium-gold shadow-[0_16px_30px_-14px_rgb(0_0_0/0.7)] [animation-delay:440ms] sm:left-[330px] sm:top-[590px] sm:h-11 sm:gap-2 sm:px-[18px] sm:text-[15px]">
              <Sparkle className="size-4" fill="currentColor" strokeWidth={0} />
              0% comisión · 12 meses
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
