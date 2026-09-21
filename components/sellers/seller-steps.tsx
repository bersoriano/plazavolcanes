import Link from "next/link";
import { ArrowRight, ImagePlus, Package, ShieldCheck, Store } from "lucide-react";

import { REPUTATION_IMPORT_AVAILABLE } from "@/lib/launch";

const REPUTATION_STEP = {
  icon: ShieldCheck,
  title: "Trae tu reputación",
  description:
    "Vincula tus perfiles de Mercado Libre, Facebook Marketplace, Amazon, Etsy o Instagram para mostrar tu historial.",
};

/** What step 2 says while the import is still only a plan. */
const CATALOG_STEP = {
  icon: ImagePlus,
  title: "Publica tus productos",
  description: "Foto, precio, categoría y condición. Guarda borradores y publica cuando quieras.",
};

const STEPS = [
  {
    icon: Store,
    title: "Crea tu tienda",
    description: "Regístrate gratis, ponle nombre a tu tienda y elige la zona donde entregas.",
  },
  REPUTATION_IMPORT_AVAILABLE ? REPUTATION_STEP : CATALOG_STEP,
  {
    icon: Package,
    title: "Publica y recibe pedidos",
    description:
      "Sube tus productos, recibe solicitudes de pedido y acuerda pago y entrega directo con cada cliente.",
  },
];

export function SellerSteps() {
  return (
    <section
      aria-labelledby="como-empezar-heading"
      className="border-y border-line bg-surface px-5 py-16 sm:px-8 lg:py-[120px]"
      id="como-empezar"
    >
      {/* One grid for both shapes: on a phone the three blocks stack and the
          call to action drops below the list, at lg it sits beside the heading. */}
      <div className="mx-auto flex max-w-[1200px] flex-col gap-7 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:gap-x-10 lg:gap-y-16">
        <div className="flex flex-col gap-3.5 lg:gap-[18px]">
          <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand lg:text-[13px]">
            Cómo empezar
          </span>
          <h2
            className="text-balance font-display text-[38px] font-medium leading-[1.02] tracking-[-0.03em] lg:text-[60px]"
            id="como-empezar-heading"
          >
            Tu tienda lista en <em className="italic text-brand">tres pasos.</em>
          </h2>
        </div>

        <Link
          className="order-3 flex h-14 shrink-0 items-center justify-center gap-2.5 rounded-full bg-brand text-[17px] font-bold text-white lg:order-none lg:px-7"
          href="/registro?vender=1"
        >
          Crear mi tienda gratis
          <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.2} />
        </Link>

        <div className="relative order-2 lg:order-none lg:col-span-2">
          <div
            aria-hidden="true"
            className="absolute bottom-24 left-[25px] top-[52px] border-l-2 border-dashed border-line lg:hidden"
          />
          <ol className="relative flex flex-col gap-7 lg:grid lg:grid-cols-3 lg:gap-6">
            {STEPS.map((step, index) => (
              <li
                className="relative grid content-start grid-cols-[52px_minmax(0,1fr)] items-start gap-x-[18px] gap-y-1.5 [grid-template-areas:'tile_paso''tile_title''tile_body'] lg:grid-cols-[56px_minmax(0,1fr)] lg:gap-y-[18px] lg:rounded-[1.75rem] lg:border lg:border-line/60 lg:bg-background lg:p-8 lg:[grid-template-areas:'tile_paso''title_title''body_body']"
                key={step.title}
              >
                <span
                  aria-hidden="true"
                  className="grid size-[52px] shrink-0 place-items-center self-start rounded-2xl bg-brand text-accent [grid-area:tile] lg:size-14 lg:self-center"
                >
                  <step.icon className="size-6 lg:size-[26px]" strokeWidth={1.8} />
                </span>
                <span className="self-center text-[12px] font-bold tracking-[0.16em] text-brand [grid-area:paso] lg:text-[14px]">
                  PASO {index + 1}
                </span>
                <h3 className="font-display text-[23px] font-semibold leading-[1.15] tracking-[-0.015em] [grid-area:title] lg:text-[28px] lg:leading-[1.1] lg:tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="text-[15px] leading-[1.6] text-muted [grid-area:body] lg:text-[16px]">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
