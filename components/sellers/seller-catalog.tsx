import { Check } from "lucide-react";

import { CatalogPreview } from "@/components/sellers/catalog-preview";

const CATALOG_POINTS = [
  "Fotos, precio y categoría de cada artículo",
  "Nuevo o usado, con su estado",
  "Guarda borradores y publica cuando quieras",
];

/** #catalogo: managing the catalogue, its own section with the current copy. */
export function SellerCatalog() {
  return (
    <section aria-label="Maneja tu catálogo de productos aquí" className="px-5 pb-16 sm:px-8 lg:pb-[120px]" id="catalogo">
      <div className="mx-auto max-w-[1200px]">
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
    </section>
  );
}
