import type { ReactNode } from "react";
import { ArrowRight, BadgeCheck, FileText, LayoutGrid, Wallet } from "lucide-react";

import { Accent, EXAMPLE_PRICE, Eyebrow, TYPE, VolcanoLines } from "@/components/home/landing/primitives";
import { REPUTATION_IMPORT_AVAILABLE } from "@/lib/launch";

type Tile = {
  title: string;
  text: string;
  icon: ReactNode;
  /** Card, icon chip and body text colours. */
  card: string;
  chip: string;
  body: string;
};

const TILES: (Tile & { shown: boolean })[] = [
  {
    title: "Sin retenciones",
    text: "Acuerdas el método de pago con tu cliente y el dinero llega directo a ti.",
    icon: <Wallet className="size-[22px] lg:size-[26px]" strokeWidth={2} />,
    card: "bg-accent text-brand",
    chip: "bg-brand text-accent",
    body: "text-brand",
    shown: true,
  },
  {
    // The first sellers' reputation is brought over by hand, so the tile only
    // names the offer.
    title: "Transfiere tu reputación",
    text: "Llega con la confianza que ya ganaste vendiendo en otros lados.",
    icon: <BadgeCheck className="size-[22px] lg:size-[26px]" strokeWidth={2} />,
    card: "border border-line bg-surface text-ink",
    chip: "bg-lilac-tint text-brand",
    body: "text-muted",
    // The promise holds only while the import exists; lib/launch.ts owns it.
    shown: REPUTATION_IMPORT_AVAILABLE,
  },
  {
    title: "Tu catálogo en un solo lugar",
    text: "Nuevo o usado, todo tu inventario en una tienda que puedes compartir.",
    icon: <LayoutGrid className="size-[22px] lg:size-[26px]" strokeWidth={2} />,
    card: "border border-line bg-surface text-ink",
    chip: "bg-gold-tint text-premium-text",
    body: "text-muted",
    shown: true,
  },
  {
    title: "Todo queda por escrito",
    text: "Mensajes, acuerdos, envío y entrega quedan ligados a cada pedido.",
    icon: <FileText className="size-[22px] lg:size-[26px]" strokeWidth={2} />,
    card: "bg-coral-tint text-ink",
    // Plum on coral: white would not reach 4.5:1.
    chip: "bg-sale text-brand",
    body: "text-coral-text",
    shown: true,
  },
];

/**
 * What a seller keeps: the 0% block and four benefits. One column of rows on
 * a phone, two columns from md with the block across the top, and from lg the
 * handoff's 4×2 grid with the block filling the left half.
 */
export function BenefitsBento() {
  const tiles = TILES.filter((tile) => tile.shown);

  return (
    <section
      aria-labelledby="vender-heading"
      className="scroll-mt-20 px-5 pb-16 pt-14 sm:px-8 lg:scroll-mt-24 lg:pb-24 lg:pt-[88px] xl:px-20"
      id="vender"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:gap-11">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-3.5 lg:gap-4">
            <Eyebrow>Para quien vende</Eyebrow>
            <h2 className={`${TYPE.h2} text-ink`} id="vender-heading">
              Lo que vendes, <Accent>es tuyo.</Accent>
            </h2>
          </div>
          <p className={`${TYPE.aside} lg:max-w-[400px] lg:pb-2`}>
            Plaza Volcanes no procesa ni retiene tu dinero. Tu cliente te paga a ti, como tú acuerdes.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:grid-rows-[320px_320px] lg:gap-5">
          <FoundersBlock />
          {tiles.map((tile, index) => (
            <article
              className={`flex items-start gap-4 rounded-[24px] p-5 md:flex-col md:justify-between md:gap-8 md:rounded-[32px] md:p-7 lg:p-8 ${tile.card} ${
                tiles.length === 3 && index === 2 ? "md:col-span-2" : ""
              }`}
              key={tile.title}
            >
              <span
                aria-hidden="true"
                className={`grid size-12 shrink-0 place-items-center rounded-2xl lg:size-14 lg:rounded-[18px] ${tile.chip}`}
              >
                {tile.icon}
              </span>
              <div className="flex flex-col gap-1.5 lg:gap-2.5">
                <h3 className={TYPE.h3}>{tile.title}</h3>
                <p className={`text-[15px] leading-[1.5] lg:text-[16px] ${tile.body}`}>{tile.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FoundersBlock() {
  return (
    <article className="relative flex flex-col gap-[18px] overflow-hidden rounded-[30px] bg-brand px-6 py-7 text-white md:col-span-2 lg:row-span-2 lg:justify-between lg:gap-6 lg:rounded-card-lg lg:p-11">
      <VolcanoLines className="pointer-events-none absolute -bottom-10 -right-10 h-[200px] w-[420px] text-accent/14 lg:h-[300px] lg:w-[630px]" />
      <p className="relative flex h-[30px] items-center self-start rounded-full border-[1.5px] border-accent px-3 text-[11px] font-bold tracking-[0.1em] text-accent lg:h-[34px] lg:px-4 lg:text-[13px]">
        TIENDAS FUNDADORAS
      </p>
      <div className="relative flex flex-col gap-1.5">
        <h3 className="flex flex-col gap-1.5">
          <span className="font-display text-[clamp(150px,106px+11.4vw,250px)] font-extrabold leading-[0.8] tracking-[-0.055em] text-accent">
            0%
          </span>{" "}
          <span className="font-display text-[28px] font-medium leading-[1.1] tracking-[-0.03em] lg:text-[40px]">
            de comisión <Accent className="text-accent">por cada venta.</Accent>
          </span>
        </h3>
      </div>
      <p className="relative max-w-[480px] text-[15px] leading-[1.55] text-white/80 lg:text-[17px]">
        Las primeras 100 tiendas que se registren durante los primeros tres meses publican gratis y no pagan comisión
        por cada artículo vendido.
      </p>
      <div className="relative flex items-center justify-between gap-4 rounded-[18px] border border-white/14 bg-white/8 px-4 py-3.5 lg:justify-start lg:rounded-[20px] lg:px-[22px] lg:py-[18px]">
        <p className="flex flex-col">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-white/70 lg:text-[12px]">VENDES EN</span>
          <span className="font-display text-[22px] font-bold lg:text-[30px]">{EXAMPLE_PRICE}</span>
        </p>
        <ArrowRight aria-hidden="true" className="hidden size-8 text-accent lg:block" strokeWidth={2} />
        <p className="flex flex-col">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-white/70 lg:text-[12px]">RECIBES</span>
          <span className="font-display text-[22px] font-bold text-accent lg:text-[30px]">{EXAMPLE_PRICE}</span>
        </p>
      </div>
    </article>
  );
}
