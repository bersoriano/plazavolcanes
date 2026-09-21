import { getTrustTierMarker, type TrustTier } from "@/lib/trust-tiers";

const TIERS: TrustTier[] = ["standard", "reliable", "top_rated"];

/**
 * The publication ladder, restyled for the new page.
 *
 * The redesign drops it, but a seller's tier is what caps how many products
 * they may publish, so it stays: finding that limit out after hitting it is the
 * kind of surprise the rest of this page exists to avoid.
 */
export function SellerTrustTiers() {
  return (
    <section
      aria-labelledby="niveles-heading"
      className="px-5 py-16 sm:px-8 lg:py-[120px]"
      id="niveles"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-7 lg:gap-14">
        <div className="flex flex-col gap-3.5 lg:gap-[18px]">
          <h2
            className="text-balance font-display text-[38px] font-medium leading-[1.02] tracking-[-0.03em] lg:text-[60px]"
            id="niveles-heading"
          >
            Cuanto mejor atiendes, <em className="italic text-brand">más publicas.</em>
          </h2>
          <p className="max-w-[640px] text-pretty text-[16px] leading-[1.6] text-muted lg:text-[18px]">
            Tu nivel se calcula con tus respuestas, envíos a tiempo, pedidos completados y reseñas.
            Nadie edita sus propias métricas.
          </p>
        </div>

        <dl className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          {TIERS.map((tier) => {
            const marker = getTrustTierMarker(tier);

            return (
              <div
                className="flex flex-col gap-2 rounded-[1.75rem] border border-line/60 bg-surface p-7 lg:p-8"
                key={tier}
              >
                <dt className="font-display text-[23px] font-semibold leading-[1.15] tracking-[-0.015em] lg:text-[28px] lg:leading-[1.1] lg:tracking-[-0.02em]">
                  {marker.label}
                </dt>
                <dd className="flex flex-col gap-2">
                  <span className="text-[15px] font-bold text-brand lg:text-[16px]">
                    {marker.listingLimit} productos publicados
                  </span>
                  <span className="text-[15px] leading-[1.6] text-muted lg:text-[16px]">
                    {marker.tooltip}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
