import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, Headphones, Plus, Watch } from "lucide-react";

import { Accent, Eyebrow, TYPE } from "@/components/home/landing/primitives";

const SIGNUP_HREF = "/registro?vender=1";

const STEPS: { number: string; title: string; text: string; snippet: ReactNode; highlight?: boolean }[] = [
  {
    number: "01",
    title: "Crea tu tienda gratis",
    text: "Ponle nombre, cuenta qué vendes y desde qué estado.",
    snippet: <NameSnippet />,
  },
  {
    number: "02",
    title: "Publica tus productos",
    text: "Sube fotos de lo nuevo o usado, ponle precio y aparece en la plaza por estado y categoría.",
    snippet: <PhotosSnippet />,
  },
  {
    number: "03",
    title: "Acepta y cobra directo",
    text: "Acuerdan pago y envío por mensajes dentro del pedido. El dinero va directo a ti.",
    snippet: <ChatSnippet />,
    highlight: true,
  },
];

/**
 * How a store gets going, in three cards. Each card's small drawing of the
 * product is an illustration only: aria-hidden and built from plain boxes, so
 * nothing in it can take focus. Stacked below lg, three columns from lg.
 */
export function SellerStepsShowcase() {
  return (
    <section
      aria-labelledby="pasos-heading"
      className="scroll-mt-20 border-y border-line bg-surface px-5 pb-14 pt-14 sm:px-8 lg:scroll-mt-24 lg:pb-20 lg:pt-[88px] xl:px-20"
      id="pasos"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:gap-12">
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-3.5 lg:gap-4">
            <Eyebrow>Abre tu tienda</Eyebrow>
            <h2 className={`${TYPE.h2} text-ink`} id="pasos-heading">
              Tres pasos y <Accent>ya vendes.</Accent>
            </h2>
          </div>
          <StepsCta className="hidden lg:inline-flex" />
        </div>

        <ol className="grid gap-4 lg:grid-cols-3 lg:gap-5">
          {STEPS.map((step) => (
            <li
              className={`flex flex-col gap-5 rounded-[28px] p-6 lg:gap-[22px] lg:rounded-[32px] lg:p-8 ${
                step.highlight ? "bg-accent text-brand" : "border border-line bg-background text-ink"
              }`}
              key={step.number}
            >
              <span
                aria-hidden="true"
                className={`font-display text-[64px] font-extrabold leading-[0.85] tracking-[-0.045em] lg:text-[96px] ${
                  step.highlight
                    ? "text-brand"
                    : "text-transparent text-outline"
                }`}
              >
                {step.number}
              </span>
              <div aria-hidden="true" className="min-h-[88px] lg:min-h-[108px]">
                {step.snippet}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className={TYPE.h3}>{step.title}</h3>
                <p className={`text-[15px] leading-[1.5] lg:text-[16px] ${step.highlight ? "text-brand" : "text-muted"}`}>
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <StepsCta className="flex lg:hidden" />
      </div>
    </section>
  );
}

function StepsCta({ className }: { className: string }) {
  return (
    <Link
      className={`h-[58px] shrink-0 items-center justify-center gap-2.5 rounded-full bg-brand px-7 text-[17px] font-semibold text-white transition-colors hover:bg-brand-hover ${className}`}
      href={SIGNUP_HREF}
    >
      Crear mi tienda gratis
      <ArrowRight aria-hidden="true" className="size-[18px] text-accent" strokeWidth={2.2} />
    </Link>
  );
}

function NameSnippet() {
  return (
    <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4">
      <span className="text-[12px] font-bold tracking-[0.06em] text-muted">NOMBRE DE TU TIENDA</span>
      <span className="flex h-11 items-center rounded-xl border-2 border-brand px-3 text-[15px] font-semibold text-ink lg:px-3.5 lg:text-[16px]">
        Tienda de [tu nombre]
        <span className="ml-0.5 h-[18px] w-0.5 bg-brand lg:h-5" />
      </span>
    </div>
  );
}

function PhotosSnippet() {
  return (
    <div className="grid h-[88px] grid-cols-3 gap-2.5 lg:h-[108px]">
      <span className="grid place-items-center rounded-[18px] bg-lilac-tint text-brand">
        <Watch className="size-[34px]" strokeWidth={1.5} />
      </span>
      <span className="grid place-items-center rounded-[18px] bg-coral-tint text-coral-ink">
        <Headphones className="size-[34px]" strokeWidth={1.5} />
      </span>
      <span className="grid place-items-center rounded-[18px] border-2 border-dashed border-brand text-brand">
        <Plus className="size-[30px]" strokeWidth={2} />
      </span>
    </div>
  );
}

function ChatSnippet() {
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <span className="self-start rounded-[18px_18px_18px_6px] bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink lg:text-[15px]">
        Nueva solicitud de pedido · Micrófono Rode
      </span>
      <span className="flex items-center gap-2 self-end rounded-[18px_18px_6px_18px] bg-brand px-4 py-2.5 text-[14px] font-semibold text-white lg:text-[15px]">
        <Check className="size-4 text-accent" strokeWidth={3} />
        Pedido aceptado
      </span>
    </div>
  );
}
