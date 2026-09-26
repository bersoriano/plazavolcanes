import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, MapPin, Plus } from "lucide-react";

import { Accent, Eyebrow, TYPE } from "@/components/home/landing/primitives";
import { REPUTATION_IMPORT_AVAILABLE } from "@/lib/launch";
import { OWNER_CTA_LABEL, sellerCtaHref, type SellerViewer } from "@/lib/seller-cta";

/** `phonePreview` false: the drawing only appears from lg, as in the phone mockup. */
type Step = { title: string; description: string; preview: ReactNode; highlight?: boolean; phonePreview?: boolean };

const REPUTATION_STEP: Step = {
  title: "Trae tu reputación",
  description: "Vincula tus perfiles de Mercado Libre, Facebook Marketplace, Amazon, Etsy o Instagram.",
  preview: <LinkedPlatforms />,
  phonePreview: false,
};

/** What step 2 says while the import is still only a plan. */
const CATALOG_STEP: Step = {
  title: "Publica tus productos",
  description: "Foto, precio, categoría y condición. Guarda borradores y publica cuando quieras.",
  preview: <AddProduct />,
  phonePreview: false,
};

const STEPS: Step[] = [
  {
    title: "Crea tu tienda",
    description: "Regístrate gratis, ponle nombre a tu tienda y elige la zona donde entregas.",
    preview: <NameField />,
  },
  REPUTATION_IMPORT_AVAILABLE ? REPUTATION_STEP : CATALOG_STEP,
  {
    title: "Publica y recibe pedidos",
    description: "Recibe solicitudes y acuerda pago y entrega directo con cada cliente.",
    preview: <OrderChat />,
    highlight: true,
  },
];

/**
 * #pasos: three cards with outlined numbers and a small drawing of each step,
 * the third on lime. The drawings are aria-hidden and hold no controls. On a
 * phone the number sits beside the title and the CTA drops below the list.
 */
export function SellerSteps({ viewer = "signed-out" }: { viewer?: SellerViewer }) {
  const cta = (
    <>
      {viewer === "owner" ? OWNER_CTA_LABEL : "Crear mi tienda gratis"}
      <ArrowRight aria-hidden="true" className="size-[18px] text-accent" strokeWidth={2.2} />
    </>
  );
  const ctaClass =
    "h-[58px] shrink-0 items-center justify-center gap-2.5 rounded-full bg-brand px-7 text-[17px] font-semibold text-white transition-colors hover:bg-brand-hover";

  return (
    <section
      aria-labelledby="como-empezar-heading"
      className="scroll-mt-20 border-y border-line bg-surface px-5 pb-14 pt-14 sm:px-8 lg:scroll-mt-24 lg:pb-20 lg:pt-[88px] xl:px-20"
      id="pasos"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:gap-12">
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-3.5 lg:gap-4">
            <Eyebrow>Cómo empezar</Eyebrow>
            <h2 className={`${TYPE.h2} text-ink`} id="como-empezar-heading">
              Tu tienda lista en <Accent>tres pasos.</Accent>
            </h2>
          </div>
          <Link className={`hidden lg:inline-flex ${ctaClass}`} href={sellerCtaHref(viewer, "pasos")}>
            {cta}
          </Link>
        </div>

        <ol className="grid gap-4 lg:grid-cols-3 lg:gap-5">
          {STEPS.map((step, index) => (
            <li
              className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-5 rounded-[26px] p-6 lg:flex lg:flex-col lg:items-stretch lg:gap-[22px] lg:rounded-[32px] lg:p-8 ${
                step.highlight ? "bg-accent text-brand" : "border border-line bg-background text-ink"
              }`}
              key={step.title}
            >
              <span
                aria-hidden="true"
                className={`font-display text-[56px] font-extrabold leading-[0.85] tracking-[-0.045em] lg:text-[96px] ${
                  step.highlight ? "text-brand" : "text-transparent text-outline"
                }`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className={`${TYPE.h3} lg:order-3`}>
                <span className="sr-only">Paso {index + 1}: </span>
                {step.title}
              </h3>
              <div
                aria-hidden="true"
                className={`order-last col-span-2 lg:order-2 lg:block lg:min-h-[108px] ${
                  step.phonePreview === false ? "hidden" : ""
                }`}
              >
                {step.preview}
              </div>
              <p
                className={`col-span-2 -mt-2 text-[15px] leading-[1.5] lg:order-4 lg:-mt-3.5 lg:text-[16px] ${
                  step.highlight ? "text-brand" : "text-muted"
                }`}
              >
                {step.description}
              </p>
            </li>
          ))}
        </ol>

        <Link className={`flex lg:hidden ${ctaClass}`} href={sellerCtaHref(viewer, "pasos")}>
          {cta}
        </Link>
      </div>
    </section>
  );
}

function NameField() {
  return (
    <div className="flex flex-col gap-2.5 lg:rounded-[20px] lg:border lg:border-line lg:bg-surface lg:p-3.5">
      <span className="hidden h-[42px] items-center rounded-xl border-2 border-brand px-3.5 text-[15px] font-semibold text-ink lg:flex">
        Tienda de [tu nombre]
        <span className="ml-0.5 h-[18px] w-0.5 bg-brand" />
      </span>
      <span className="flex h-[30px] items-center gap-1.5 self-start rounded-full bg-lime-tint px-3 text-[13px] font-semibold text-brand">
        <MapPin className="size-3.5" strokeWidth={2} />
        Entrego en Ciudad de México
      </span>
    </div>
  );
}

function LinkedPlatforms() {
  return (
    <div className="hidden min-h-[108px] flex-wrap content-center gap-2 text-[13px] font-semibold lg:flex">
      {["Mercado Libre", "Facebook Marketplace"].map((platform) => (
        <span className="flex h-[34px] items-center gap-1.5 rounded-full bg-brand px-3 text-white" key={platform}>
          {platform}
          <Check className="size-3.5 text-accent" strokeWidth={3} />
        </span>
      ))}
      {["Amazon", "Etsy", "Instagram"].map((platform) => (
        <span
          className="flex h-[34px] items-center gap-1 rounded-full border-[1.5px] border-dashed border-brand bg-surface px-3 text-ink"
          key={platform}
        >
          <Plus className="size-3.5" strokeWidth={2.4} />
          {platform}
        </span>
      ))}
    </div>
  );
}

function AddProduct() {
  return (
    <div className="hidden h-[108px] grid-cols-3 gap-2.5 lg:grid">
      <span className="rounded-[18px] bg-lilac-tint" />
      <span className="rounded-[18px] bg-coral-tint" />
      <span className="grid place-items-center rounded-[18px] border-2 border-dashed border-brand text-brand">
        <Plus className="size-7" strokeWidth={2} />
      </span>
    </div>
  );
}

function OrderChat() {
  return (
    <div className="flex flex-col justify-center gap-2 text-[14px] font-semibold lg:min-h-[108px] lg:text-[15px]">
      <span className="hidden self-start rounded-[18px_18px_18px_6px] bg-surface px-4 py-2.5 text-ink lg:block">
        Nueva solicitud de pedido · Micrófono Rode
      </span>
      <span className="flex items-center gap-2 self-end rounded-[18px_18px_6px_18px] bg-brand px-4 py-2.5 text-white">
        <Check className="size-4 text-accent" strokeWidth={3} />
        Pedido aceptado
      </span>
    </div>
  );
}
