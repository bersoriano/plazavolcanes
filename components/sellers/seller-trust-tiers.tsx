import { CircleCheck, MessageCircle, Star, Truck } from "lucide-react";

import { Accent, Eyebrow, TYPE } from "@/components/home/landing/primitives";
import { getTrustTierMarker, type TrustTier } from "@/lib/trust-tiers";

const METRICS = [
  { label: "Respuestas", icon: MessageCircle },
  { label: "Envíos a tiempo", icon: Truck },
  { label: "Pedidos completados", icon: CircleCheck },
  { label: "Reseñas", icon: Star },
];

/**
 * Each rung of the ladder. The label and the publishing limit come from the
 * tiers themselves (lib/trust-tiers.ts), so the page cannot drift from what
 * the plaza enforces; the description is this page's own wording.
 */
const RUNGS: { tier: TrustTier; description: string; card: string; kicker: string; limit: string; title: string; body: string; height: string }[] = [
  {
    tier: "standard",
    description: "Nivel inicial mientras tu tienda reúne evidencia de servicio, cumplimiento y satisfacción.",
    card: "border border-line bg-surface",
    kicker: "text-muted",
    limit: "text-brand",
    title: "text-ink",
    body: "text-muted",
    height: "lg:h-[300px]",
  },
  {
    tier: "reliable",
    description:
      "Cumples de forma consistente con respuestas, envíos, pedidos completados y baja tasa de disputas.",
    card: "border-[1.5px] border-brand bg-lime-tint",
    kicker: "text-brand",
    limit: "text-brand",
    title: "text-ink",
    body: "text-text-body",
    height: "lg:h-[380px]",
  },
  {
    tier: "top_rated",
    description: "Los estándares más altos de servicio, cumplimiento, actividad y satisfacción en la plaza.",
    card: "bg-brand",
    kicker: "text-accent",
    limit: "text-accent",
    title: "text-white",
    body: "text-white/80",
    height: "lg:h-[460px]",
  },
];

/**
 * #niveles: the publishing ladder, three rungs rising from lg with the
 * founders' 50 marked above Confiable while the promotion runs. Three equal
 * columns at md, stacked on a phone. The marker spans the grid's full row
 * (centred over Confiable at md, offset from the grid at lg): an absolutely
 * placed grid item measures from its own grid area, not from the grid.
 */
export function SellerTrustTiers({ promoActive = true }: { promoActive?: boolean }) {
  return (
    <section
      aria-labelledby="niveles-heading"
      className="scroll-mt-20 px-5 pb-16 pt-14 sm:px-8 lg:scroll-mt-24 lg:pb-24 lg:pt-24 xl:px-20"
      id="niveles"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:gap-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-3.5 lg:gap-4">
            <Eyebrow>Niveles de tienda</Eyebrow>
            <h2 className={`${TYPE.h2} text-ink`} id="niveles-heading">
              Cuanto mejor atiendes, <Accent>más publicas.</Accent>
            </h2>
          </div>
          <p className={`${TYPE.aside} lg:max-w-[400px] lg:pb-2`}>
            Tu nivel se calcula con datos reales de tu tienda. Nadie edita sus propias métricas.
          </p>
        </div>

        <ul aria-label="Lo que mide tu nivel" className="flex flex-wrap gap-2.5">
          {METRICS.map((metric) => (
            <li
              className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold lg:text-[15px]"
              key={metric.label}
            >
              <metric.icon aria-hidden="true" className="size-[18px] text-brand" strokeWidth={2} />
              {metric.label}
            </li>
          ))}
        </ul>

        <div className="relative grid gap-3 md:grid-cols-3 md:gap-5 lg:h-[460px] lg:items-end lg:pt-0">
          {RUNGS.map((rung, index) => {
            const marker = getTrustTierMarker(rung.tier);

            return (
              <article
                className={`flex flex-col gap-1.5 rounded-[22px] px-5 py-4 md:gap-3 md:rounded-[26px] md:p-6 lg:rounded-[32px] lg:p-[30px] ${rung.card} ${rung.height} ${
                  index === 2 ? "order-3" : index === 1 ? "order-1" : "order-0"
                }`}
                key={rung.tier}
              >
                <span className={`hidden text-[12px] font-bold uppercase tracking-[0.1em] md:block lg:text-[13px] ${rung.kicker}`}>
                  Nivel {index + 1}
                </span>
                {/* A phone keeps the name and the limit on one line, as its mockup does. */}
                <div className="flex items-baseline justify-between gap-3 md:flex-col md:gap-3">
                  <h3 className={`font-display text-[26px] font-semibold tracking-[-0.03em] lg:text-[34px] ${rung.title}`}>
                    {marker.label}
                  </h3>
                  <p className={`shrink-0 font-display text-[17px] font-bold md:text-[20px] lg:text-[22px] ${rung.limit}`}>
                    Hasta {marker.listingLimit}
                    <span className="hidden md:inline"> productos</span>
                  </p>
                </div>
                <p className={`text-[14px] leading-[1.5] md:mt-auto md:pt-2 md:text-[15px] ${rung.body}`}>{rung.description}</p>
              </article>
            );
          })}

          {promoActive ? (
            <p className="order-2 flex h-12 -rotate-3 items-center gap-2 justify-self-center rounded-full border-2 border-premium-ink bg-premium-gold px-[18px] text-[14px] font-extrabold text-premium-ink shadow-[0_12px_24px_-12px_rgb(0_0_0/0.5)] md:order-first md:col-span-3 md:justify-self-center lg:absolute lg:left-[calc((100%-40px)/3+6px)] lg:top-3 lg:text-[15px]">
              <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} viewBox="0 0 24 24">
                <path d="M2 18 8 9.5l2.5 2.5 3-4.5L22 18" />
              </svg>
              Tiendas fundadoras: 50 desde el día uno
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
