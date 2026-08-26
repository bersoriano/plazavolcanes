import { BadgeCheck, MessagesSquare, Scale, ShieldCheck } from "lucide-react";

const signals = [
  {
    icon: ShieldCheck,
    title: "El pago es directo",
    description:
      "Acuerdas el método de pago con la tienda y le pagas directamente. Plaza Volcanes no procesa, retiene ni puede devolver ese dinero.",
  },
  {
    icon: BadgeCheck,
    title: "Revisa a la tienda",
    description:
      "Consulta su antigüedad, actividad e indicadores disponibles antes de decidir. Estos datos ayudan a comparar; no garantizan el resultado.",
  },
  {
    icon: MessagesSquare,
    title: "Deja todo por escrito",
    description:
      "Mensajes, acuerdos, envío y entrega quedan asociados al pedido. Usa ese registro si necesitas aclarar lo ocurrido.",
  },
  {
    icon: Scale,
    title: "Una disputa documenta el problema",
    description:
      "Puedes abrir una disputa y adjuntar evidencia. Administración puede revisarla y registrar una resolución, pero Plaza Volcanes no controla el pago ni garantiza un reembolso.",
  },
];

export function TrustStrip() {
  return (
    <section
      aria-label="Antes de acordar una compra"
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
