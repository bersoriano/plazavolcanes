import Link from "next/link";
import { ArrowRight, ClipboardCheck, Compass, HandHeart } from "lucide-react";

const steps = [
  {
    icon: Compass,
    title: "Explora y compara",
    description:
      "Busca por categoría o palabra clave y revisa el nivel de cada tienda antes de decidir.",
  },
  {
    icon: ClipboardCheck,
    title: "Solicita tu pedido",
    description:
      "Envías la solicitud, la tienda la acepta y acuerdan pago y envío por mensajes dentro del pedido.",
  },
  {
    icon: HandHeart,
    title: "Confirma y reseña",
    description:
      "Al recibir confirmas la entrega y dejas tu reseña. Eso define el nivel de la tienda.",
  },
];

export function BuyerSteps({ catalogHref }: { catalogHref: string }) {
  return (
    <section
      aria-labelledby="comprar-heading"
      className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12"
    >
      <div className="rounded-[2rem] border border-line bg-surface px-6 py-10 sm:px-10 sm:py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
          Para quien compra
        </p>
        <h2
          className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl"
          id="comprar-heading"
        >
          Cómo comprar en la plaza
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          No necesitas cuenta para mirar. La pides cuando quieras enviar tu primera solicitud de
          pedido.
        </p>
        <ol className="mt-9 grid gap-5 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li className="rounded-[1.5rem] border border-line bg-background p-6" key={step.title}>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand text-accent">
                  <step.icon aria-hidden="true" className="size-5" />
                </span>
                <span className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
                  Paso {index + 1}
                </span>
              </div>
              <p className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] text-ink">
                {step.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
        <Link
          className="mt-9 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-7 font-semibold text-white transition-transform hover:-translate-y-0.5"
          href={catalogHref}
        >
          Ver productos
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}
