import Link from "next/link";
import { ArrowRight, ImagePlus, PackageCheck, Store } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { getTrustTierMarker, type TrustTier } from "@/lib/trust-tiers";

const steps = [
  {
    icon: Store,
    title: "Crea tu tienda",
    description: "Nombre, descripción y estado. Queda pública en minutos, sin revisión previa.",
  },
  {
    icon: ImagePlus,
    title: "Publica tus productos",
    description: "Foto, precio, categoría y condición. Guarda borradores y publica cuando quieras.",
  },
  {
    icon: PackageCheck,
    title: "Recibe solicitudes",
    description: "Acuerdas pago y envío con la persona compradora y confirmas la entrega en la plaza.",
  },
];

const tiers: TrustTier[] = ["standard", "reliable", "top_rated"];

export function SellerPitch() {
  return (
    <section
      aria-labelledby="vender-heading"
      className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12"
    >
      <div className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14">
        <VolcanoMark className="pointer-events-none absolute -bottom-16 right-0 w-[560px] max-w-none text-accent/15" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Para quien vende
          </p>
          <h2
            className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl"
            id="vender-heading"
          >
            Vende en Plaza Volcanes
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
            Publicar es gratis y sin comisiones. Abres tu tienda, subes tus productos y recibes
            solicitudes de pedido de personas que ya están buscando lo que haces.
          </p>

          <ol className="mt-10 grid gap-5 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li
                className="rounded-[1.5rem] border border-white/15 bg-white/5 p-6"
                key={step.title}
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-accent text-brand-hover">
                    <step.icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                    Paso {index + 1}
                  </span>
                </div>
                <p className="mt-4 font-display text-xl font-semibold tracking-[-0.02em]">
                  {step.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/70">{step.description}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 rounded-[1.5rem] border border-white/15 bg-white/5 p-6 sm:p-8">
            <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">
              Cuanto mejor atiendes, más publicas
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Tu nivel se calcula con tus respuestas, envíos a tiempo, pedidos completados y
              reseñas. Nadie edita sus propias métricas.
            </p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              {tiers.map((tier) => {
                const marker = getTrustTierMarker(tier);

                return (
                  <div
                    className="rounded-[1.25rem] bg-brand-hover/60 p-5"
                    key={tier}
                  >
                    <dt className="font-display text-lg font-semibold tracking-[-0.02em] text-accent">
                      {marker.label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-white">
                      {marker.listingLimit} productos publicados
                    </dd>
                    <p className="mt-2 text-xs leading-5 text-white/60">{marker.tooltip}</p>
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-7 font-semibold text-brand-hover transition-transform hover:-translate-y-0.5"
              href="/registro"
            >
              Abrir mi tienda
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              className="inline-flex min-h-12 items-center rounded-full border border-white/25 px-6 font-semibold text-white transition-colors hover:border-accent hover:text-accent"
              href="/ingresar"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
