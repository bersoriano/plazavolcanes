import { BadgeCheck, MessagesSquare, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";

const signals = [
  {
    icon: ShieldCheck,
    title: "Sin adelantos a la plaza",
    description:
      "Acuerdas el pago directamente con la tienda. Plaza Volcanes nunca retiene tu dinero.",
  },
  {
    icon: BadgeCheck,
    title: "Sabes quién te vende",
    description:
      "Cada tienda muestra su antigüedad y su historial de desempeño antes de que envíes una solicitud.",
  },
  {
    icon: MessagesSquare,
    title: "Cada pedido deja rastro",
    description:
      "Mensajes, tiempos de respuesta, envío y entrega quedan registrados dentro del pedido.",
  },
  {
    icon: Scale,
    title: "Un canal para reclamar",
    description:
      "Si algo sale mal, abres una aclaración y queda registrada con su evidencia. Plaza Volcanes no retiene pagos ni impone resoluciones.",
    href: "/quejas-y-aclaraciones",
    linkLabel: "Quejas y aclaraciones",
  },
];

export function TrustStrip() {
  return (
    <section
      aria-label="Compra con respaldo"
      className="border-b border-line bg-background"
    >
      <div className="mx-auto grid max-w-[1440px] gap-x-8 gap-y-7 px-5 py-9 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-12">
        {signals.map((signal) => (
          <div className="flex gap-3.5" key={signal.title}>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-brand-hover">
              <signal.icon aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="font-display text-base font-semibold tracking-[-0.01em] text-ink">
                {signal.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">{signal.description}</p>
              {signal.href ? (
                <Link
                  className="mt-2 inline-block text-sm font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
                  href={signal.href}
                >
                  {signal.linkLabel}
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
