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
 * themselves are painted at once and the page's largest image is not held
 * back by an animation.
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
      <div aria-hidden="true" className="relative h-[105.714cqw] sm:h-[116.667cqw]">
        <PhotoTile
          className="left-0 top-[5.714cqw] h-[54.286cqw] w-[42.857cqw] -rotate-6 bg-lilac-tint text-brand sm:top-[6.667cqw] sm:h-[50cqw] sm:w-[40cqw]"
          fallbackIcon={<Shirt className="size-[45%] opacity-80" strokeWidth={1.2} />}
          preload
          product={first}
        />
        <PhotoTile
          className="left-[58.571cqw] top-0 h-[51.429cqw] w-[40cqw] rotate-6 bg-coral-tint text-coral-ink sm:left-[60cqw] sm:top-[1cqw] sm:h-[48.333cqw] sm:w-[38.333cqw]"
          fallbackIcon={<Camera className="size-[45%]" strokeWidth={1.2} />}
          product={second}
        />

        <Receipt />

        <span className="animate-rise-in absolute left-[13.714cqw] top-[27.429cqw] flex h-[10.286cqw] -rotate-4 items-center gap-[2cqw] rounded-full bg-brand px-[4cqw] text-[3.714cqw] font-bold text-accent shadow-[0_12px_24px_-10px_rgb(50_23_77/0.6)] [animation-delay:240ms] sm:left-[30cqw] sm:top-[29.667cqw] sm:h-[7.333cqw] sm:gap-[1.333cqw] sm:px-[3cqw] sm:text-[2.5cqw]">
          <Wallet className="hidden size-[3cqw] sm:block" strokeWidth={2} />
          Te pagan directo
        </span>

        <span className="animate-rise-in absolute left-[70.857cqw] top-[27.429cqw] flex size-[29.714cqw] rotate-12 flex-col items-center justify-center rounded-full border-[0.857cqw] border-brand bg-accent text-brand shadow-[0_16px_30px_-12px_rgb(50_23_77/0.5)] [animation-delay:360ms] sm:left-[73.333cqw] sm:top-[80cqw] sm:size-[26.667cqw] sm:border-[0.667cqw]">
          <span className="font-display text-[11.429cqw] font-extrabold leading-[0.9] tracking-[-0.05em] sm:text-[10.333cqw]">0%</span>
          <span className="text-[3.143cqw] font-bold uppercase tracking-[0.08em] sm:text-[2.5cqw]">comisión</span>
        </span>

        {latest ? (
          <div className="animate-rise-in absolute left-0 top-[96.667cqw] hidden w-[55cqw] items-center gap-[2.333cqw] rounded-[3.667cqw] bg-surface p-[2cqw] shadow-[0_20px_40px_-20px_rgb(50_23_77/0.45)] [animation-delay:480ms] sm:flex">
            <span className="relative grid size-[12cqw] shrink-0 place-items-center overflow-hidden rounded-[2.667cqw] bg-photo-backdrop text-brand">
              <LandingPhoto
                fallback={<Mic className="size-[47%]" strokeWidth={1.5} />}
                sizes="72px"
                src={latest.imageUrl}
              />
            </span>
            <span className="flex min-w-0 flex-col gap-[0.333cqw]">
              <span className="text-[1.833cqw] font-bold tracking-[0.12em] text-success">RECIÉN PUBLICADO</span>
              <span className="truncate text-[2.833cqw] font-bold text-ink">{latest.name}</span>
              <span className="text-[2.833cqw] font-bold text-brand">
                {formatCurrency(latest.price_mxn, latest.currency_code ?? DEFAULT_CATALOG_CURRENCY, locale)}{" "}
                <span className="text-[2cqw] font-semibold text-muted">{latest.currency_code ?? DEFAULT_CATALOG_CURRENCY}</span>
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
  fallbackIcon,
  preload = false,
}: {
  product: CollageProduct | null;
  className: string;
  fallbackIcon: React.ReactNode;
  preload?: boolean;
}) {
  const fallback = <span className="grid size-full place-items-center">{fallbackIcon}</span>;

  return (
    <div className={`absolute overflow-hidden rounded-[6.286cqw] shadow-float sm:rounded-[4.667cqw] ${className}`}>
      <LandingPhoto
        fallback={fallback}
        preload={preload}
        sizes="(max-width: 639px) 150px, 240px"
        src={product?.imageUrl ?? null}
      />
      {product ? (
        <span className="absolute left-[2.333cqw] top-[2.333cqw] hidden h-[4.667cqw] items-center rounded-full bg-surface px-[2cqw] text-[2cqw] font-semibold text-ink sm:flex">
          {formatProductCondition(product.condition, product.used_condition)}
        </span>
      ) : null}
    </div>
  );
}

function Receipt() {
  return (
    <div className="animate-rise-in absolute left-[8.571cqw] top-[38.857cqw] flex w-[82.857cqw] flex-col leading-[1.2] gap-[2.857cqw] rounded-[6.286cqw] bg-surface p-[5.143cqw] text-ink shadow-[0_24px_48px_-20px_rgb(50_23_77/0.5)] [animation-delay:120ms] sm:left-[23.333cqw] sm:top-[39.333cqw] sm:w-[61.667cqw] sm:gap-[2.333cqw] sm:rounded-[4.667cqw] sm:p-[4cqw] sm:shadow-[0_30px_60px_-24px_rgb(50_23_77/0.5)]">
      <div className="flex items-center gap-[2.857cqw] sm:gap-[2cqw]">
        <span className="grid size-[9.143cqw] shrink-0 place-items-center rounded-full bg-accent text-brand sm:size-[6.667cqw]">
          <Check className="size-1/2" strokeWidth={2.6} />
        </span>
        <span className="flex flex-col">
          <span className="text-[4cqw] font-bold sm:text-[2.667cqw]">Pedido confirmado</span>
          <span className="text-[3.429cqw] text-muted sm:text-[2.167cqw]">Tu tienda · Pago directo</span>
        </span>
      </div>
      <span className="h-px bg-hairline" />
      <ReceiptRow className="hidden sm:flex" label="Precio de venta" value={EXAMPLE_PRICE} valueClassName="font-semibold" />
      <ReceiptRow label="Comisión Plaza Volcanes" value={ZERO} valueClassName="font-bold text-success" />
      <ReceiptRow label="Retención" value={ZERO} valueClassName="font-bold text-success" />
      <span className="h-px bg-hairline" />
      <div className="flex items-baseline justify-between">
        <span className="text-[3.714cqw] font-bold sm:text-[2.5cqw]">Tú recibes</span>
        <span className="font-display text-[8cqw] font-bold tracking-[-0.03em] text-brand sm:text-[6.333cqw]">{EXAMPLE_PRICE}</span>
      </div>
    </div>
  );
}

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
    <div className={`${className} justify-between text-[3.714cqw] sm:text-[2.5cqw]`}>
      <span className="text-muted">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}
