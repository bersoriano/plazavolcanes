import { BadgeCheck, MessagesSquare, Scale, ShieldCheck } from "lucide-react";

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
      "Cada tienda muestra su nivel de verificación y su antigüedad antes de que envíes una solicitud.",
  },
  {
    icon: MessagesSquare,
    title: "Cada pedido deja rastro",
    description:
      "Mensajes, tiempos de respuesta, envío y entrega quedan registrados dentro del pedido.",
  },
  {
    icon: Scale,
    title: "Disputas con arbitraje",
    description:
      "Si algo sale mal, abres una disputa y administración revisa la evidencia de ambas partes.",
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
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
