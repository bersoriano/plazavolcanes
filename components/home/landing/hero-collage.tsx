import type { CSSProperties, ReactNode } from "react";
import { Camera, Check, Mic, Shirt, Wallet } from "lucide-react";

import { LandingPhoto } from "@/components/home/landing/landing-photo";
import { EXAMPLE_PRICE } from "@/components/home/landing/primitives";
import {
  DEFAULT_CATALOG_CURRENCY,
  DEFAULT_CATALOG_LOCALE,
  type CatalogLocale,
} from "@/lib/catalog-locale";
import { formatCurrency } from "@/lib/format";
import { formatProductCondition, type ProductCondition, type UsedCondition } from "@/lib/product-condition";

export type CollageProduct = {
  id: number;
  name: string;
  imageUrl: string | null;
  price_mxn: number | string;
  currency_code?: string;
  condition: ProductCondition;
  used_condition: UsedCondition | null;
};

const ZERO = "$0.00";

type CqKey = "l" | "t" | "w" | "h" | "s" | "r" | "p" | "px" | "g" | "fs" | "b";

/**
 * One piece's geometry for the cq-* utilities in globals.css, in cqw: a
 * single number for both canvases, or [phone, sm]. Both values are always
 * set on the element itself, so a piece never inherits its parent's.
 */
function cq(values: Partial<Record<CqKey, number | [number, number]>>) {
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    const [phone, wide] = Array.isArray(value) ? value : [value, value];
    style[`--cq-${key}`] = `${phone}cqw`;
    style[`--cq-s${key}`] = `${wide}cqw`;
  }
  return style as CSSProperties;
}

/**
 * The hero's right-hand picture: two tilted product photos, a receipt that
 * shows the seller keeps the whole price, a chip, a sticker and, from sm, the
 * newest listing.
 *
 * Everything is placed in container-width units (cqw) against the handoff's
 * own canvases — 350×370 on a phone, 600×700 from sm — so the composition
 * scales as one piece from a 320px phone to the desktop column instead of
 * reflowing and overlapping. Below sm one cqw is 3.5px of the phone canvas;
 * from sm it is 6px of the desktop one.
 *
 * The whole picture is aria-hidden; the summary above it carries its facts.
 * Only the cards that float over the photos make an entrance, so the photos
 * themselves are painted at once.
 *
 * No photo is preloaded: the page's largest paint is the h1 at every width,
 * and on a phone the collage sits below the fold, where a preload only
 * competed with the stylesheet and fonts (Lighthouse mobile LCP ~4.1s with
 * it, ~3.5s without).
 */
export function HeroCollage({
  tiles,
  latest,
  locale = DEFAULT_CATALOG_LOCALE,
}: {
  tiles: [CollageProduct | null, CollageProduct | null];
  latest: CollageProduct | null;
  locale?: CatalogLocale;
}) {
  const [first, second] = tiles;
  const summary = [
    `Ejemplo de pedido: precio de venta ${EXAMPLE_PRICE}, comisión Plaza Volcanes ${ZERO}, retención ${ZERO}, tú recibes ${EXAMPLE_PRICE}.`,
    latest
      ? `Recién publicado: ${latest.name}, ${formatCurrency(latest.price_mxn, latest.currency_code ?? DEFAULT_CATALOG_CURRENCY, locale)}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="@container mx-auto w-full max-w-[350px] sm:max-w-[600px]">
      <p className="sr-only">{summary}</p>
      <div aria-hidden="true" className="relative cq-h" style={cq({ h: [105.714, 116.667] })}>
        <PhotoTile
          className="-rotate-6 bg-lilac-tint text-brand"
          fallbackIcon={<Shirt className="size-[45%] opacity-80" strokeWidth={1.2} />}
          geometry={{ l: 0, t: [5.714, 6.667], w: [42.857, 40], h: [54.286, 50] }}
          product={first}
        />
        <PhotoTile
          className="rotate-6 bg-coral-tint text-coral-ink"
          fallbackIcon={<Camera className="size-[45%]" strokeWidth={1.2} />}
          geometry={{ l: [58.571, 60], t: [0, 1], w: [40, 38.333], h: [51.429, 48.333] }}
          product={second}
        />

        <Receipt />

        <span
          className="animate-rise-in absolute flex -rotate-4 items-center rounded-full bg-brand font-bold text-accent shadow-cta cq-pos cq-h cq-gap cq-px cq-text [animation-delay:240ms]"
          style={cq({ l: [13.714, 30], t: [27.429, 29.667], h: [10.286, 7.333], g: [2, 1.333], px: [4, 3], fs: [3.714, 2.5] })}
        >
          <Wallet className="hidden size-[3cqw] sm:block" strokeWidth={2} />
          Te pagan directo
        </span>

        <span
          className="animate-rise-in absolute flex rotate-12 flex-col items-center justify-center rounded-full border-brand bg-accent text-brand shadow-float cq-pos cq-size cq-border [animation-delay:360ms]"
          style={cq({ l: [70.857, 73.333], t: [27.429, 80], s: [29.714, 26.667], b: [0.857, 0.667] })}
        >
          <span
            className="font-display font-extrabold leading-[0.9] tracking-[-0.045em] cq-text"
            style={cq({ fs: [11.429, 10.333] })}
          >
            0%
          </span>
          <span className="font-bold uppercase tracking-[0.08em] cq-text" style={cq({ fs: [3.143, 2.5] })}>
            comisión
          </span>
        </span>

        {latest ? (
          <div
            className="animate-rise-in absolute hidden items-center bg-surface shadow-float cq-pos cq-w cq-gap cq-r cq-p [animation-delay:480ms] sm:flex"
            style={cq({ l: 0, t: 96.667, w: 55, g: 2.333, r: 3.667, p: 2 })}
          >
            <span
              className="relative grid shrink-0 place-items-center overflow-hidden bg-photo-backdrop text-brand cq-size cq-r"
              style={cq({ s: 12, r: 2.667 })}
            >
              <LandingPhoto
                fallback={<Mic className="size-[47%]" strokeWidth={1.5} />}
                sizes="72px"
                src={latest.imageUrl}
              />
            </span>
            <span className="flex min-w-0 flex-col cq-gap" style={cq({ g: 0.333 })}>
              <span className="font-bold tracking-[0.12em] text-success cq-text" style={cq({ fs: 1.833 })}>
                RECIÉN PUBLICADO
              </span>
              <span className="truncate font-bold text-ink cq-text" style={cq({ fs: 2.833 })}>
                {latest.name}
              </span>
              <span className="font-bold text-brand cq-text" style={cq({ fs: 2.833 })}>
                {formatCurrency(latest.price_mxn, latest.currency_code ?? DEFAULT_CATALOG_CURRENCY, locale)}{" "}
                <span className="font-semibold text-muted cq-text" style={cq({ fs: 2 })}>
                  {latest.currency_code ?? DEFAULT_CATALOG_CURRENCY}
                </span>
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PhotoTile({
  product,
  className,
  geometry,
  fallbackIcon,
}: {
  product: CollageProduct | null;
  className: string;
  geometry: Parameters<typeof cq>[0];
  fallbackIcon: ReactNode;
}) {
  const fallback = <span className="grid size-full place-items-center">{fallbackIcon}</span>;

  return (
    <div
      className={`absolute overflow-hidden shadow-float cq-pos cq-w cq-h cq-r ${className}`}
      style={cq({ ...geometry, r: [6.286, 4.667] })}
    >
      <LandingPhoto fallback={fallback} sizes="(max-width: 639px) 150px, 240px" src={product?.imageUrl ?? null} />
      {product ? (
        <span
          className="absolute hidden items-center rounded-full bg-surface font-semibold text-ink cq-pos cq-h cq-px cq-text sm:flex"
          style={cq({ l: 2.333, t: 2.333, h: 4.667, px: 2, fs: 2 })}
        >
          {formatProductCondition(product.condition, product.used_condition)}
        </span>
      ) : null}
    </div>
  );
}

function Receipt() {
  return (
    <div
      className="animate-rise-in absolute flex flex-col bg-surface leading-[1.2] text-ink shadow-float cq-pos cq-w cq-gap cq-r cq-p [animation-delay:120ms]"
      style={cq({ l: [8.571, 23.333], t: [38.857, 39.333], w: [82.857, 61.667], g: [2.857, 2.333], r: [6.286, 4.667], p: [5.143, 4] })}
    >
      <div className="flex items-center cq-gap" style={cq({ g: [2.857, 2] })}>
        <span className="grid shrink-0 place-items-center rounded-full bg-accent text-brand cq-size" style={cq({ s: [9.143, 6.667] })}>
          <Check className="size-1/2" strokeWidth={2.6} />
        </span>
        <span className="flex flex-col">
          <span className="font-bold cq-text" style={cq({ fs: [4, 2.667] })}>
            Pedido confirmado
          </span>
          <span className="text-muted cq-text" style={cq({ fs: [3.429, 2.167] })}>
            Tu tienda · Pago directo
          </span>
        </span>
      </div>
      <span className="h-px bg-hairline" />
      <ReceiptRow className="hidden sm:flex" label="Precio de venta" value={EXAMPLE_PRICE} valueClassName="font-semibold" />
      <ReceiptRow label="Comisión Plaza Volcanes" value={ZERO} valueClassName="font-bold text-success" />
      <ReceiptRow label="Retención" value={ZERO} valueClassName="font-bold text-success" />
      <span className="h-px bg-hairline" />
      <div className="flex items-baseline justify-between">
        <span className="font-bold cq-text" style={ROW_TEXT}>
          Tú recibes
        </span>
        <span className="font-display font-bold tracking-[-0.03em] text-brand cq-text" style={cq({ fs: [8, 6.333] })}>
          {EXAMPLE_PRICE}
        </span>
      </div>
    </div>
  );
}

const ROW_TEXT = cq({ fs: [3.714, 2.5] });

function ReceiptRow({
  label,
  value,
  valueClassName,
  className = "flex",
}: {
  label: string;
  value: string;
  valueClassName: string;
  className?: string;
}) {
  return (
    <div className={`${className} justify-between cq-text`} style={ROW_TEXT}>
      <span className="text-muted">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}
