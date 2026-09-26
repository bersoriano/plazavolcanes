import Link from "next/link";

const PROMO_ANSWER =
  "Sí. Las primeras 100 tiendas que se registren durante los primeros tres meses pueden publicar gratis y no pagan comisión por cada artículo vendido.";
const STANDING_ANSWER = "Sí. Publicar es gratis y Plaza Volcanes no cobra comisión por cada artículo vendido.";
const AFTER_PROMO_QUESTION = "¿Qué pasa cuando termine la promoción?";

const QUESTIONS = [
  {
    question: "¿De verdad no cobran comisión?",
    answer: PROMO_ANSWER,
  },
  {
    question: "¿Cómo recibo mi dinero?",
    answer:
      "Directo de tu cliente. Acuerdan juntos el método de pago y Plaza Volcanes no procesa ni retiene ese dinero, así que no hay retenciones.",
  },
  {
    question: "¿Qué pasa si hay un problema con un pedido?",
    answer:
      "Mensajes, acuerdos, envío y entrega quedan registrados en el pedido. Si un cliente abre una aclaración, puedes responder y administración registra una resolución.",
  },
  {
    question: AFTER_PROMO_QUESTION,
    answer: "La publicación y la comisión por artículo vendido seguirán siendo gratuitas.",
  },
];

/**
 * `promoActive` false: every shop publishes free and pays no commission, so
 * the first answer stops naming the founders and the question about the end
 * of the promotion leaves.
 */
export function SellerFaq({ promoActive = true }: { promoActive?: boolean }) {
  const questions = promoActive
    ? QUESTIONS
    : QUESTIONS.filter((entry) => entry.question !== AFTER_PROMO_QUESTION).map((entry) =>
        entry.answer === PROMO_ANSWER ? { ...entry, answer: STANDING_ANSWER } : entry,
      );
  return (
    <section
      aria-labelledby="preguntas-heading"
      className="px-5 py-16 sm:px-8 lg:py-[120px]"
      id="preguntas"
    >
      {/* auto/1fr, so the answers spanning both rows cannot stretch the first
          one and push the closing line away from the heading it belongs to. */}
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-6">
        <div className="flex flex-col gap-3.5 lg:col-span-4 lg:col-start-1 lg:row-start-1 lg:gap-[18px]">
          <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand lg:text-[13px]">
            Preguntas de quien vende
          </span>
          <h2
            className="font-display text-[36px] font-medium leading-[1.04] tracking-[-0.03em] lg:text-[48px]"
            id="preguntas-heading"
          >
            Lo que te estás <em className="italic text-brand">preguntando.</em>
          </h2>
        </div>

        {/* On a phone this closing line belongs after the answers; beside them
            at lg, where the left column would otherwise end early. */}
        <p className="order-3 text-[15px] leading-[1.6] text-muted lg:order-none lg:col-span-4 lg:col-start-1 lg:row-start-2 lg:mt-[18px] lg:self-start lg:text-[16px]">
          ¿Tienes otra duda? Revisa los{" "}
          <Link
            className="font-semibold text-brand underline decoration-accent decoration-[3px] underline-offset-4"
            href="/terminos-vendedores"
          >
            Términos para vendedores
          </Link>
          .
        </p>

        <div className="order-2 flex flex-col lg:order-none lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          {questions.map((entry, index) => (
            <div
              className={`flex flex-col gap-2 border-t border-line py-[22px] lg:gap-2.5 lg:py-7 ${
                index === questions.length - 1 ? "border-b" : ""
              }`}
              key={entry.question}
            >
              <h3 className="font-display text-[20px] font-semibold leading-[1.2] lg:text-[23px] lg:tracking-[-0.015em]">
                {entry.question}
              </h3>
              <p className="text-[15px] leading-[1.65] text-muted lg:text-[16px]">{entry.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
