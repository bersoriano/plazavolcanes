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
      aria-labelledby="confianza-heading"
      className="px-5 pb-16 pt-14 sm:px-8 lg:pb-[104px] lg:pt-24"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-7 lg:gap-10">
        <h2
          className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand lg:text-[13px]"
          id="confianza-heading"
        >
          Antes de acordar una compra
        </h2>
        <div className="flex flex-col gap-7 sm:grid sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-4">
          {signals.map((signal) => (
            <div
              className="flex gap-4 border-t-2 border-brand pt-5 lg:flex-col lg:gap-3.5 lg:pt-6"
              key={signal.title}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-[0.8125rem] bg-accent text-brand-hover lg:size-12 lg:rounded-[0.875rem]">
                <signal.icon aria-hidden="true" className="size-[22px]" strokeWidth={1.8} />
              </span>
              <div className="flex flex-col gap-1.5 lg:gap-3.5">
                <h3 className="font-display text-[19px] font-semibold leading-[1.2] text-ink lg:text-[21px] lg:tracking-[-0.015em]">
                  {signal.title}
                </h3>
                <p className="text-[15px] leading-[1.6] text-muted">{signal.description}</p>
                {signal.href ? (
                  <Link
                    className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-brand underline decoration-accent decoration-[3px] underline-offset-[5px]"
                    href={signal.href}
                  >
                    {signal.linkLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
