import { ArrowUpRight, Camera, Headphones, Smartphone } from "lucide-react";

import { Accent, Eyebrow, TYPE, VolcanoLines } from "@/components/home/landing/primitives";
import { FounderSeal } from "@/components/sellers/founder-seal";
import {
  BASE_LISTING_LIMIT,
  FOUNDER_COMMISSION_LOCK_MONTHS,
  FOUNDER_FEATURE_DAYS,
  FOUNDER_LISTING_LIMIT,
  FOUNDER_MIN_LIVE_ITEMS,
  FOUNDER_QUALIFY_DAYS,
  FOUNDERS_CAP,
} from "@/lib/launch";

/** The store mock's published count: an illustration, not anybody's store. */
const EXAMPLE_PUBLISHED = 12;

/**
 * #fundadoras: what a founding seat brings, and how it is earned. A plum
 * block with a mock of a founder's shop, then one tile per perk. Only
 * rendered while seats remain.
 */
export function FoundersPackage() {
  return (
    <section
      aria-labelledby="fundadoras-paquete-heading"
      className="scroll-mt-20 px-5 pb-16 pt-14 sm:px-8 lg:scroll-mt-24 lg:pb-24 lg:pt-20 xl:px-20"
      id="fundadoras"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:gap-11">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-3.5 lg:gap-4">
            <Eyebrow>Paquete fundador</Eyebrow>
            <h2 className={`${TYPE.h2} text-ink`} id="fundadoras-paquete-heading">
              Lo que te llevas <br className="hidden sm:inline" />
              por <Accent>publicar primero.</Accent>
            </h2>
          </div>
          <p className={`${TYPE.aside} lg:max-w-[400px] lg:pb-2`}>
            Para las primeras {FOUNDERS_CAP} tiendas que publiquen {FOUNDER_MIN_LIVE_ITEMS} productos en sus primeros{" "}
            {FOUNDER_QUALIFY_DAYS} días. Registrarte no aparta un lugar: se gana publicando.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-[290px_290px] lg:gap-5">
          <article className="relative col-span-2 flex flex-col justify-between gap-7 overflow-hidden rounded-[30px] bg-brand p-5 sm:p-8 lg:row-span-2 lg:rounded-card-lg lg:p-10">
            <VolcanoLines className="pointer-events-none absolute -bottom-10 -right-10 h-[200px] w-[420px] text-accent opacity-[0.14] lg:h-[300px] lg:w-[630px]" />
            <StoreMock />
            <div className="relative flex flex-col gap-2.5 text-white">
              <h3 className="font-display text-[30px] font-semibold leading-[1.02] tracking-[-0.03em] lg:text-[40px]">
                Así luce una <Accent className="text-accent">tienda fundadora.</Accent>
              </h3>
              <p className="text-[15px] text-white/70 lg:text-[16px]">
                Insignia permanente, marco dorado en tus tarjetas y acceso anticipado a las nuevas herramientas para
                vender.
              </p>
            </div>
          </article>

          <PerkTile className="bg-accent text-brand" figure={String(FOUNDER_LISTING_LIMIT)} title="productos en vivo">
            Todas las tiendas publican {BASE_LISTING_LIMIT} gratis. Las fundadoras, {FOUNDER_LISTING_LIMIT}, sin fecha de
            vencimiento.
          </PerkTile>
          <PerkTile
            bodyClassName="text-premium-text"
            className="bg-gold-tint text-premium-ink"
            figure={<FounderSeal className="size-16 border-[3px] lg:size-[84px]" labelled={false} />}
            title="Insignia fundadora"
          >
            Permanente, con marco dorado en tu tienda y tus productos.
          </PerkTile>
          <PerkTile
            bodyClassName="text-muted"
            className="border border-line bg-surface text-ink"
            figure="0%"
            figureClassName="text-brand"
            title={`comisión fija ${FOUNDER_COMMISSION_LOCK_MONTHS} meses`}
          >
            Durante tus primeros {FOUNDER_COMMISSION_LOCK_MONTHS} meses como fundadora no pagas comisión, cambie lo que
            cambie.
          </PerkTile>
          <PerkTile
            bodyClassName="text-white/70"
            className="bg-premium-ink text-white"
            figure={String(FOUNDER_FEATURE_DAYS)}
            figureClassName="text-premium-gold"
            title="días en la portada"
            titleClassName="text-premium-gold"
          >
            Tu tienda rota en la portada de Plaza Volcanes durante {FOUNDER_FEATURE_DAYS} días.
          </PerkTile>
        </div>
      </div>
    </section>
  );
}

function PerkTile({
  figure,
  title,
  children,
  className,
  figureClassName = "",
  titleClassName = "",
  bodyClassName = "",
}: {
  figure: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className: string;
  figureClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <article className={`flex min-h-[220px] flex-col justify-between gap-5 rounded-[24px] p-5 lg:min-h-0 lg:rounded-[32px] lg:p-[30px] ${className}`}>
      {typeof figure === "string" ? (
        <span
          aria-hidden="true"
          className={`font-display text-[64px] font-extrabold leading-[0.8] tracking-[-0.05em] lg:text-[120px] ${figureClassName}`}
        >
          {figure}
        </span>
      ) : (
        figure
      )}
      <div className="flex flex-col gap-2">
        <h3 className={`font-display text-[20px] font-semibold leading-[1.1] tracking-[-0.025em] lg:text-[28px] ${titleClassName}`}>
          {typeof figure === "string" ? <span className="sr-only">{figure} </span> : null}
          {title}
        </h3>
        <p className={`text-[14px] leading-[1.5] lg:text-[15px] ${bodyClassName}`}>{children}</p>
      </div>
    </article>
  );
}

/** A store as a founder would open it: an illustration, hidden from screen readers. */
function StoreMock() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-[440px] -rotate-2 overflow-hidden rounded-[22px] bg-surface text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.7)] lg:rounded-[26px]"
    >
      <div className="flex h-[100px] items-center justify-center gap-5 bg-lilac-tint text-brand lg:h-[120px]">
        <Smartphone className="size-9" strokeWidth={1.4} />
        <Headphones className="size-11" strokeWidth={1.3} />
        <Camera className="size-9" strokeWidth={1.4} />
      </div>
      <div className="flex flex-col gap-3 px-[18px] py-4 lg:px-[22px] lg:py-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-[22px] font-semibold tracking-[-0.025em] lg:text-[26px]">Tu tienda</span>
          <ArrowUpRight className="size-5 text-brand" />
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <span className="flex h-7 items-center gap-1.5 rounded-full bg-premium-gold px-2.5 font-extrabold text-premium-ink">
            <svg className="size-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} viewBox="0 0 24 24">
              <path d="M2 18 8 9.5l2.5 2.5 3-4.5L22 18" />
            </svg>
            Tienda fundadora
          </span>
          <span className="flex h-7 items-center rounded-full bg-lime-tint px-2.5 font-bold text-brand">Nivel Estándar</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px] font-semibold">
            <span className="text-muted">Artículos publicados</span>
            <span>
              {EXAMPLE_PUBLISHED} de {FOUNDER_LISTING_LIMIT}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-progress-track">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(EXAMPLE_PUBLISHED / FOUNDER_LISTING_LIMIT) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
