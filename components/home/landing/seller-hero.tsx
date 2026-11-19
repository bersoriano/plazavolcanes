import { FoundersCounter } from "@/components/home/landing/founders-counter";
import { HeroCollage, type CollageProduct } from "@/components/home/landing/hero-collage";
import { PrimaryCta, TYPE, VolcanoLines } from "@/components/home/landing/primitives";
import { ButtonLink } from "@/components/ui/button";
import type { CatalogLocale } from "@/lib/catalog-locale";
import type { CatalogProduct } from "@/lib/queries/catalog.server";

/**
 * The seller hero of the "Tu tienda, tus reglas" campaign
 * (docs/superpowers/specs/2026-11-19-tu-tienda-tus-reglas-campaign-design.md):
 * the pitch and its two ways forward on the left, the
 * collage on the right. The two sit side by side from xl, where the text
 * column still has room for the 100px heading; below that they stack, the
 * collage keeping its desktop composition down to sm.
 */
export function SellerHero({
  latest,
  example,
  locale,
  promoActive = true,
  spotsTaken = null,
}: {
  latest: CollageProduct | null;
  example?: CatalogProduct | null;
  locale?: CatalogLocale;
  /** False once the founders promotion has ended: the card leaves the hero. */
  promoActive?: boolean;
  /** Founding spots taken, when there is a count to show. */
  spotsTaken?: number | null;
}) {
  return (
    <section
      aria-labelledby="inicio-heading"
      className="relative overflow-hidden px-5 pb-12 pt-7 sm:px-8 lg:pb-16 lg:pt-16 hero-glow xl:px-20"
    >
      <VolcanoLines className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] w-full text-brand/8 lg:h-[260px]" />

      <div className="relative mx-auto flex max-w-[1280px] flex-col gap-[22px] xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,600px)] xl:items-start xl:gap-10">
        <div className="flex flex-col items-start gap-[22px] lg:gap-[30px]">
          <p className="flex h-[30px] items-center gap-2 rounded-full border border-brand/10 bg-lime-tint px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-brand lg:h-[34px] lg:gap-2.5 lg:px-4 lg:text-[12px] lg:tracking-[0.12em]">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand lg:size-[7px]" />
            Para tiendas independientes de México
          </p>

          {/* Two lines at every width: the campaign line reads as a slogan,
              "tus reglas." on a tilted lime marker like the share image's. */}
          <h1 className={`${TYPE.h1} text-ink`} id="inicio-heading">
            <span className="block">Tu tienda,</span>{" "}
            <em className="mt-[0.06em] inline-block -rotate-2 rounded-[0.18em] bg-accent px-[0.14em] pb-[0.08em] italic text-brand shadow-cta">
              tus reglas.
            </em>
          </h1>

          <p className="max-w-[560px] text-pretty text-[17px] leading-[1.55] text-text-body lg:text-[20px]">
            Tú pones los precios, eliges cómo cobrar y acuerdas la entrega con cada cliente. Plaza Volcanes no toca tu dinero: sin comisión en pago directo.
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-3.5">
            <PrimaryCta block href="/registro?vender=1">
              Abrir mi tienda gratis
            </PrimaryCta>
            {example ? <ButtonLink
              variant="unstyled"
              className="inline-flex h-[58px] items-center justify-center rounded-full border-[1.5px] border-line bg-surface px-7 text-[17px] font-semibold text-ink transition-colors hover:border-brand lg:h-[62px] lg:text-[18px]"
              href={`/tiendas/${example.shop.slug}`}
            >
              Ver una tienda de ejemplo
            </ButtonLink> : <p className="self-center text-sm text-muted">Pronto podrás ver una tienda de ejemplo.</p>}
          </div>

          {promoActive ? <FoundersCounter spotsTaken={spotsTaken} /> : null}
        </div>

        <HeroCollage latest={latest} locale={locale} />
      </div>
    </section>
  );
}
