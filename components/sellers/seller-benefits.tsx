import { Check, Info } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { CatalogPreview } from "@/components/sellers/catalog-preview";
import { ReputationFlow } from "@/components/sellers/reputation-flow";
import { FOUNDERS_CAP } from "@/lib/launch";

const CATALOG_POINTS = [
  "Fotos, precio y categoría de cada artículo",
  "Nuevo o usado, con su estado",
  "Guarda borradores y publica cuando quieras",
];

export function SellerBenefits() {
  return (
    <section
      aria-labelledby="beneficios-heading"
      className="px-5 py-16 sm:px-8 lg:pb-[120px] lg:pt-[128px]"
      id="beneficios"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-4 grid gap-3.5 lg:mb-14 lg:grid-cols-12 lg:items-end lg:gap-x-6">
          <div className="flex flex-col gap-3.5 lg:col-span-7 lg:gap-[18px]">
            <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand lg:text-[13px]">
              Por qué vender aquí
            </span>
            <h2
              className="text-balance font-display text-[38px] font-medium leading-[1.02] tracking-[-0.03em] lg:text-[60px]"
              id="beneficios-heading"
            >
              Hecho para quien vende <em className="italic text-brand">por su cuenta.</em>
            </h2>
          </div>
          <p className="text-pretty text-[16px] leading-[1.6] text-muted lg:col-span-5 lg:text-[18px]">
            Plaza Volcanes es una plaza para tiendas independientes de México. Tú pones los productos
            y el trato con tus clientes; nosotros, la vitrina.
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-6">
          <article className="relative flex flex-col gap-5 overflow-hidden rounded-[1.75rem] bg-brand px-6 py-7 text-white lg:col-span-5 lg:min-h-[580px] lg:justify-between lg:gap-6 lg:rounded-[2rem] lg:p-10">
            <VolcanoMark
              className="pointer-events-none absolute -right-[140px] top-9 h-[112px] w-[420px] max-w-none text-accent opacity-[0.12] lg:-right-[120px] lg:top-10 lg:h-[149px] lg:w-[560px]"
              strokeWidth={6}
            />
            <div className="relative flex items-center justify-between">
              <span className="text-[13px] font-bold tracking-[0.12em] text-white/60 lg:text-[14px]">
                01
              </span>
              <span className="rounded-full border border-accent/50 px-2.5 py-[5px] text-[11px] font-bold uppercase tracking-[0.08em] text-accent lg:px-3 lg:py-1.5 lg:text-[12px]">
                Lanzamiento
              </span>
            </div>
            <p className="relative font-display text-[148px] font-bold leading-[0.82] tracking-[-0.06em] text-accent lg:text-[220px]">
              0%
            </p>
            <div className="relative flex flex-col gap-3.5">
              <h3 className="font-display text-[28px] font-semibold leading-[1.08] tracking-[-0.02em] lg:text-[34px]">
                Sin retenciones ni comisiones
              </h3>
              <p className="text-pretty text-[16px] leading-[1.6] text-white/80 lg:text-[17px]">
                Tu cliente te paga directo a ti, con el método que acuerden. Plaza Volcanes no
                procesa, no retiene y no descuenta nada de tu venta.
              </p>
              <p className="flex items-start gap-2.5 border-t border-white/15 pt-4 text-[13px] leading-[1.5] text-white/70 lg:mt-1.5 lg:pt-[18px] lg:text-[14px]">
                <Info aria-hidden="true" className="mt-px size-[17px] shrink-0 lg:size-[18px]" strokeWidth={1.8} />
                Para las primeras {FOUNDERS_CAP} tiendas que se registren durante los primeros tres
                meses.
              </p>
            </div>
          </article>

          <article className="flex flex-col gap-4 rounded-[1.75rem] border border-line bg-surface px-6 py-7 lg:col-span-7 lg:gap-7 lg:rounded-[2rem] lg:p-10">
            <div className="flex flex-col gap-3.5 lg:gap-[14px]">
              <span className="text-[13px] font-bold tracking-[0.12em] text-muted lg:text-[14px]">
                02
              </span>
              <h3 className="text-balance font-display text-[28px] font-semibold leading-[1.08] tracking-[-0.02em] lg:text-[34px]">
                Transfiere tu reputación de otras plataformas
              </h3>
              <p className="text-pretty text-[16px] leading-[1.6] text-muted lg:text-[17px]">
                ¿Ya tienes ventas y buenas calificaciones en otro lado? Tráelas a tu tienda para que
                tus nuevos clientes vean desde el primer día que eres de confianza.
              </p>
            </div>
            <ReputationFlow />
          </article>

          <article className="flex flex-col gap-4 rounded-[1.75rem] bg-accent px-6 py-7 text-brand-hover lg:col-span-12 lg:grid lg:grid-cols-12 lg:items-center lg:gap-6 lg:rounded-[2rem] lg:p-12">
            <div className="flex flex-col gap-4 lg:col-span-5">
              <span className="text-[13px] font-bold tracking-[0.12em] text-brand-hover/60 lg:text-[14px]">
                03
              </span>
              <h3 className="text-balance font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.025em] lg:text-[42px] lg:leading-[1.04]">
                Maneja tu catálogo de productos aquí
              </h3>
              <p className="text-pretty text-[16px] leading-[1.6] text-brand-hover/85 lg:text-[17px]">
                Sube, edita y organiza todos tus productos desde un solo lugar. Tu tienda pública se
                actualiza con cada cambio.
              </p>
              <ul className="flex flex-col gap-2.5 lg:mt-2 lg:gap-3">
                {CATALOG_POINTS.map((point) => (
                  <li
                    className="flex items-center gap-2.5 text-[15px] font-semibold lg:gap-3 lg:text-[16px]"
                    key={point}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-accent lg:size-[26px]"
                    >
                      <Check className="size-[13px] lg:size-3.5" strokeWidth={3} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-7">
              <CatalogPreview />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
