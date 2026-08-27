import { BadgeCheck, MessagesSquare, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";

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
    // Deliberately does not mention evidence: no code path collects it. The
    // dispute schemas have no evidence field, openDispute and respondToDispute
    // both pass p_evidence: [], and the dispute form has no upload control, so
    // order_disputes.buyer_evidence stays permanently empty. What the flow
    // actually records is the written description, a seller response and an
    // admin resolution.
    icon: Scale,
    title: "Una disputa documenta el problema",
    description:
      "Abres una aclaración con tu descripción de lo ocurrido. El vendedor puede responder y administración puede registrar una resolución. Plaza Volcanes no retiene el pago ni obliga a un reembolso.",
    href: "/quejas-y-aclaraciones",
    linkLabel: "Quejas y aclaraciones",
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
              {signal.href ? (
                <Link
                  className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
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
