import Link from "next/link";

import { FoundersCounter } from "@/components/home/landing/founders-counter";
import { HeroCollage, type CollageProduct } from "@/components/home/landing/hero-collage";
import { PrimaryCta, TYPE, VolcanoLines } from "@/components/home/landing/primitives";
import type { CatalogLocale } from "@/lib/catalog-locale";

/**
 * The seller hero: the pitch and its two ways forward on the left, the
 * collage on the right. The two sit side by side from xl, where the text
 * column still has room for the 100px heading; below that they stack, the
 * collage keeping its desktop composition down to sm.
 */
export function SellerHero({
  tiles,
  latest,
  locale,
}: {
  tiles: [CollageProduct | null, CollageProduct | null];
  latest: CollageProduct | null;
  locale?: CatalogLocale;
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

          <h1 className={`${TYPE.h1} text-ink`} id="inicio-heading">
            Vende lo tuyo.{" "}
            <br />
            <em className="italic text-brand">Quédate con</em>{" "}
            <span className="mt-2.5 inline-block -rotate-[2.5deg] rounded-[18px] bg-accent px-[0.2em] pb-[0.08em] text-brand shadow-[0_6px_0_var(--brand)] lg:rounded-[26px]">
              todo.
            </span>
          </h1>

          <p className="max-w-[560px] text-pretty text-[17px] leading-[1.55] text-text-body lg:text-[20px]">
            Abre tu tienda en Plaza Volcanes, publica productos nuevos o usados y recibe el pago directo de cada cliente.
            Sin comisiones. Sin retenciones.
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-3.5">
            <PrimaryCta block href="/registro?vender=1">
              Abrir mi tienda gratis
            </PrimaryCta>
            <Link
              className="inline-flex h-[58px] items-center justify-center rounded-full border-[1.5px] border-line bg-surface px-7 text-[17px] font-semibold text-ink transition-colors hover:border-brand lg:h-[62px] lg:text-[18px]"
              href="#explorar"
            >
              Explorar productos
            </Link>
          </div>

          <FoundersCounter />
        </div>

        <HeroCollage latest={latest} locale={locale} tiles={tiles} />
      </div>
    </section>
  );
}
