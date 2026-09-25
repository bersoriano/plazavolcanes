import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ImageIcon, Store } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { CatalogImage } from "@/components/catalog/catalog-image";
import { CatalogJumpLink } from "@/components/catalog/catalog-jump-link";
import {
  DEFAULT_CATALOG_CURRENCY,
  DEFAULT_CATALOG_LOCALE,
  type CatalogLocale,
} from "@/lib/catalog-locale";
import { formatCurrency } from "@/lib/format";

/** Three things the product actually does for someone who has not signed up. */
const CHECKLIST = ["No necesitas crear una cuenta para ver los productos.", "Pagale directamente a cada tienda", "Todo queda por escrito"];

/** The collage's own summary, for anyone who never sees the picture. */
const COLLAGE_SUMMARY =
  "Ilustración: una compradora rodeada de fotos de artículos nuevos y usados de tiendas independientes de México.";

/** The newest listing on the plaza, as the collage's floating card shows it. */
export type HomeHeroListing = {
  name: string;
  imageUrl: string | null;
  price_mxn: number | string;
  currency_code?: string;
};

type HomeHeroProps = {
  /** The first product of the home catalogue; the card stays out while there is none. */
  featured?: HomeHeroListing | null;
  locale?: CatalogLocale;
};

/**
 * The home hero: one buyer message on the left and a collage of the plaza on
 * the right. Below lg the two stack, with the collage after the checklist.
 * Its bottom padding leaves room for the search panel that overlaps it.
 */
export function HomeHero({ featured, locale = DEFAULT_CATALOG_LOCALE }: HomeHeroProps) {
  return (
    <section
      aria-labelledby="inicio-heading"
      className="relative overflow-hidden px-5 pb-[124px] pt-8 sm:px-8 lg:pb-[164px] lg:pt-[72px]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial-[90%_40%_at_90%_0%] from-accent/32 via-accent/10 via-45% to-accent/0 to-75% lg:bg-radial-[58%_52%_at_84%_6%] lg:from-accent/30 lg:via-42% lg:to-72%"
      />
      <VolcanoMark
        className="pointer-events-none absolute -bottom-5 -left-[140px] h-[186px] w-[700px] max-w-none text-brand opacity-[0.06] lg:-bottom-10 lg:-left-[60px] lg:h-[414px] lg:w-[1560px]"
        strokeWidth={4}
      />

      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-6">
        <div className="flex flex-col items-start gap-5 lg:col-span-7 lg:gap-[26px]">
          <p className="flex items-center gap-2 rounded-full border border-brand/22 bg-accent/22 py-1.5 pl-2.5 pr-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-hover lg:gap-2.5 lg:py-[7px] lg:pl-3 lg:pr-4 lg:text-[12px]">
            <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-brand lg:size-2" />
            PUBLICA Y ADMINISTRA TUS VENTAS AQUÍ
          </p>

          <h1
            className="text-balance font-display text-[46px] font-medium leading-[1] tracking-[-0.035em] text-ink lg:text-wrap lg:text-[80px] lg:leading-[0.98]"
            id="inicio-heading"
          >
            Encuentra productos únicos <em className="italic text-brand">cerca de ti.</em>
          </h1>

          <p className="max-w-[520px] text-pretty text-[17px] leading-[1.55] text-muted lg:text-[20px]">
            Explora artículos nuevos y usados, revisa quién vende y acuerda pago y entrega
            directamente con cada tienda.
          </p>

          <div className="flex flex-col gap-2.5 self-stretch sm:flex-row sm:self-auto lg:mt-1 lg:gap-3.5">
            <CatalogJumpLink className="flex h-14 items-center justify-center gap-2.5 rounded-full bg-brand text-[17px] font-bold text-white shadow-[0_14px_30px_-14px] shadow-brand/70 transition-colors hover:bg-brand-hover sm:px-[30px] lg:h-[60px] lg:text-[18px]">
              Explorar productos
              <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.2} />
            </CatalogJumpLink>
            <Link
              className="flex h-14 items-center justify-center rounded-full border border-line bg-surface text-[17px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand sm:px-7 lg:h-[60px] lg:text-[18px]"
              href="/vender?desde=hero"
            >
              Quiero vender
            </Link>
          </div>

          <ul className="mt-1 flex flex-col gap-3 self-stretch border-t border-line pt-5 lg:mt-3.5 lg:flex-row lg:flex-wrap lg:gap-x-6 lg:pt-[26px]">
            {CHECKLIST.map((item) => (
              <li
                className="flex items-center gap-2.5 text-[15px] font-semibold text-ink lg:gap-2 lg:text-[14px]"
                key={item}
              >
                <span
                  aria-hidden="true"
                  className="grid size-[22px] shrink-0 place-items-center rounded-full bg-brand text-accent"
                >
                  <Check className="size-[13px]" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-2 lg:col-span-5 lg:mt-0">
          <p className="sr-only">{COLLAGE_SUMMARY}</p>
          {/* Offsets are fractions of the mockup's column (350px on a phone,
              486px at 1440) so the collage narrows with its column instead of
              spilling out of it. */}
          <div
            aria-hidden="true"
            className={`relative mx-auto w-full max-w-[440px] lg:max-w-none ${
              featured ? "h-[410px] lg:h-[500px]" : "h-[340px] lg:h-[460px]"
            }`}
            data-testid="hero-collage"
          >
            <div className="absolute left-[13.7%] top-[26px] h-[270px] w-[72.6%] overflow-hidden rounded-[1.5rem] border border-line bg-surface shadow-[0_26px_50px_-30px] shadow-brand-hover/35 lg:left-[13.6%] lg:top-[30px] lg:h-[356px] lg:w-[69.1%] lg:rounded-[1.75rem] lg:shadow-[0_30px_60px_-36px]">
              <Image
                alt=""
                className="object-contain object-bottom"
                fill
                preload
                sizes="(max-width: 1023px) 320px, 336px"
                src="/herogirl.jpg"
              />
            </div>
            <div className="absolute -right-[1.1%] top-1 h-[158px] w-[33.7%] rotate-5 overflow-hidden rounded-[1.125rem] border-[3px] border-surface shadow-[0_24px_44px_-22px] shadow-brand-hover/55 lg:-right-[3.7%] lg:top-1.5 lg:h-[228px] lg:w-[35%] lg:rounded-[1.375rem] lg:border-4 lg:shadow-[0_30px_60px_-28px]">
              <Image alt="" className="object-cover" fill sizes="170px" src="/new-items.jpg" />
            </div>
            <div className="absolute -left-[1.1%] top-[172px] h-[160px] w-[34.3%] -rotate-6 overflow-hidden rounded-[1.125rem] border-[3px] border-surface shadow-[0_24px_44px_-22px] shadow-brand-hover/55 lg:-left-[4.9%] lg:top-[226px] lg:h-[228px] lg:w-[35.4%] lg:rounded-[1.375rem] lg:border-4 lg:shadow-[0_30px_60px_-28px]">
              <Image alt="" className="object-cover" fill sizes="172px" src="/used-items.jpg" />
            </div>
            <div className="absolute left-[18.3%] top-0 flex -rotate-3 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 py-2 text-[12px] font-bold text-brand-hover shadow-[0_14px_26px_-16px] shadow-brand-hover/60 lg:left-[17.3%] lg:top-0.5 lg:gap-2 lg:px-4 lg:py-2.5 lg:text-[14px] lg:shadow-[0_16px_30px_-18px]">
              <Store className="size-4" strokeWidth={2} />
              Tiendas independientes de México
            </div>
            {featured ? <FeaturedListing listing={featured} locale={locale} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedListing({ listing, locale }: { listing: HomeHeroListing; locale: CatalogLocale }) {
  const currencyCode = listing.currency_code ?? DEFAULT_CATALOG_CURRENCY;

  return (
    <div
      className="absolute left-[17.7%] top-[300px] flex w-[81.1%] -rotate-[1.5deg] items-center gap-3 rounded-[1.125rem] border border-line bg-surface p-3 shadow-[0_26px_50px_-24px] shadow-brand-hover/55 lg:left-[30.9%] lg:top-[368px] lg:w-[61.7%] lg:gap-3.5 lg:rounded-[1.25rem] lg:p-3.5 lg:shadow-[0_30px_60px_-28px]"
      data-testid="hero-featured-listing"
    >
      <span className="grid size-[58px] shrink-0 place-items-center overflow-hidden rounded-xl bg-photo-backdrop text-muted/70 lg:size-[68px] lg:rounded-[0.875rem]">
        <CatalogImage
          alt=""
          className="size-full object-cover"
          fallback={<ImageIcon className="size-6" strokeWidth={1.6} />}
          src={listing.imageUrl}
        />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 lg:gap-[3px]">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-success lg:text-[11px]">
          Recién publicado
        </span>
        <span className="truncate font-display text-[16px] font-bold text-ink lg:text-[17px]">
          {listing.name}
        </span>
        <span className="flex items-baseline gap-[5px] lg:gap-1.5">
          <span className="font-display text-[18px] font-bold tracking-[-0.02em] text-brand tabular-nums lg:text-[20px]">
            {formatCurrency(listing.price_mxn, currencyCode, locale)}
          </span>
          <span className="text-[11px] font-semibold text-muted lg:text-[12px]">{currencyCode}</span>
        </span>
      </span>
    </div>
  );
}
