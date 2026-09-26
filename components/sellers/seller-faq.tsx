import Link from "next/link";
import { Minus, Plus } from "lucide-react";

import { Accent, Eyebrow } from "@/components/home/landing/primitives";

const PROMO_ANSWER =
  "Sí. Las primeras 100 tiendas que se registren durante los primeros tres meses pueden publicar gratis y no pagan comisión por cada artículo vendido.";
const STANDING_ANSWER = "Sí. Publicar es gratis y Plaza Volcanes no cobra comisión por cada artículo vendido.";

const FOUNDERS_QUESTION = {
  question: "¿Qué incluye ser tienda fundadora?",
  answer:
    "Las primeras 100 tiendas que se registren durante los primeros tres meses abren 1 tienda gratis con hasta 50 artículos publicados, reciben la insignia de Tienda fundadora y tienen estatus Premium durante 1 año. Y como en toda la plaza: 0% comisión y pago directo.",
};

const AFTER_FIRST_YEAR = {
  question: "¿Qué pasa después del primer año?",
  answer:
    "Al terminar el primer año, la tienda y los 50 artículos publicados dejan de ser gratuitos. La comisión sigue en 0% y tu cliente te sigue pagando directo.",
};

function questionsFor(promoActive: boolean) {
  return [
    ...(promoActive ? [FOUNDERS_QUESTION] : []),
    { question: "¿De verdad no cobran comisión?", answer: promoActive ? PROMO_ANSWER : STANDING_ANSWER },
    {
      question: "¿Cómo recibo mi dinero?",
      answer:
        "Directo de tu cliente. Acuerdan juntos el método de pago y Plaza Volcanes no procesa ni retiene ese dinero, así que no hay retenciones.",
    },
    {
      question: "¿Cuántos productos puedo publicar?",
      answer:
        "Depende del nivel de tu tienda: Estándar hasta 15, Confiable hasta 40 y Mejor valorada hasta 100. Las tiendas fundadoras pueden publicar hasta 50 desde el primer día.",
    },
    {
      question: "¿Qué pasa si hay un problema con un pedido?",
      answer:
        "Mensajes, acuerdos, envío y entrega quedan registrados en el pedido. Si un cliente abre una aclaración, puedes responder y administración registra una resolución.",
    },
    // A founder's question, so it leaves with the founders offer.
    ...(promoActive ? [AFTER_FIRST_YEAR] : []),
  ];
}

/**
 * #preguntas: a native exclusive accordion (<details name>), so the browser
 * announces each item's state and handles the keyboard. The first item opens
 * by default. `promoActive` false drops the two founders questions and states
 * the standing commission rule.
 */
export function SellerFaq({ promoActive = true }: { promoActive?: boolean }) {
  const questions = questionsFor(promoActive);

  return (
    <section
      aria-labelledby="preguntas-heading"
      className="scroll-mt-20 border-t border-line bg-surface px-5 py-14 sm:px-8 lg:scroll-mt-24 lg:py-[88px] xl:px-20"
      id="preguntas"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:flex-row lg:items-start lg:gap-20">
        <div className="flex flex-col gap-3.5 lg:sticky lg:top-28 lg:w-[420px] lg:shrink-0 lg:gap-[18px]">
          <Eyebrow>Preguntas de quien vende</Eyebrow>
          <h2
            className="font-display text-[clamp(40px,31.1px+2.286vw,64px)] font-semibold leading-[0.98] tracking-[-0.04em] text-ink"
            id="preguntas-heading"
          >
            Lo que te estás <Accent>preguntando.</Accent>
          </h2>
          <p className="text-[15px] leading-[1.55] text-muted lg:text-[16px]">
            ¿Tienes otra duda? Revisa los{" "}
            <Link
              className="font-bold text-brand underline decoration-accent decoration-[3px] underline-offset-4"
              href="/terminos-vendedores"
            >
              Términos para vendedores
            </Link>
            .
          </p>
        </div>

        <div className="flex grow flex-col">
          {questions.map((entry, index) => (
            <details
              className="faq-item group border-b border-hairline px-4 open:rounded-[20px] open:border-[1.5px] open:border-brand open:bg-background lg:px-[26px] lg:open:rounded-[24px]"
              key={entry.question}
              name="preguntas"
              open={index === 0}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 py-5 font-display text-[19px] font-semibold tracking-[-0.02em] text-ink lg:py-[22px] lg:text-[22px] lg:group-open:text-[24px] [&::-webkit-details-marker]:hidden">
                {entry.question}
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-full border-[1.5px] border-line text-brand group-open:border-brand group-open:bg-brand group-open:text-accent"
                >
                  <Plus className="size-4 group-open:hidden" strokeWidth={2.4} />
                  <Minus className="hidden size-4 group-open:block" strokeWidth={2.4} />
                </span>
              </summary>
              <p className="max-w-[680px] pb-6 text-[15px] leading-[1.6] text-text-body lg:text-[16px]">{entry.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
