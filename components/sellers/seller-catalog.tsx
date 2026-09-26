import { Check } from "lucide-react";

import { Accent, VolcanoLines } from "@/components/home/landing/primitives";
import { CatalogPreview } from "@/components/sellers/catalog-preview";

const CATALOG_POINTS = [
  "Fotos, precio y categoría de cada artículo",
  "Nuevo o usado, con su estado",
  "Guarda borradores y publica cuando quieras",
];

/**
 * #catalogo: managing the catalogue, its own lime panel with the current
 * copy. The panel stacks below xl, where the preview would have no room
 * beside the text.
 */
export function SellerCatalog() {
  return (
    <section
      aria-labelledby="catalogo-heading"
      className="scroll-mt-20 px-5 pb-16 sm:px-8 lg:scroll-mt-24 lg:pb-20 xl:px-20"
      id="catalogo"
    >
      <div className="relative mx-auto flex max-w-[1280px] flex-col gap-8 overflow-hidden rounded-[30px] bg-accent p-6 text-brand sm:p-10 lg:rounded-[40px] xl:flex-row xl:items-center xl:gap-14 xl:p-14">
        <VolcanoLines className="pointer-events-none absolute inset-x-0 bottom-0 h-[160px] w-full text-brand opacity-10 lg:h-[260px]" />
        <div className="relative flex flex-col gap-5 xl:w-[460px] xl:shrink-0 xl:gap-[22px]">
          <span
            aria-hidden="true"
            className="font-display text-[44px] font-extrabold leading-[0.85] tracking-[-0.035em] text-transparent text-outline lg:text-[56px]"
          >
            03
          </span>
          <h2
            className="font-display text-[clamp(36px,29.3px+1.714vw,56px)] font-semibold leading-[0.98] tracking-[-0.036em] text-ink"
            id="catalogo-heading"
          >
            Maneja tu catálogo de productos <Accent>aquí.</Accent>
          </h2>
          <p className="text-[16px] leading-[1.55] lg:text-[18px]">
            Sube, edita y organiza todos tus productos desde un solo lugar. Tu tienda pública se actualiza con cada
            cambio.
          </p>
          <ul className="flex flex-col gap-3 text-[15px] font-semibold lg:text-[17px]">
            {CATALOG_POINTS.map((point) => (
              <li className="flex items-center gap-3" key={point}>
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-accent">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative min-w-0 grow">
          <CatalogPreview />
        </div>
      </div>
    </section>
  );
}
