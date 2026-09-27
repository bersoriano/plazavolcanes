import Link from "next/link";
import { Minus, Plus } from "lucide-react";

import { Accent, Eyebrow } from "@/components/home/landing/primitives";
import {
  BASE_LISTING_LIMIT,
  FOUNDER_COMMISSION_LOCK_MONTHS,
  FOUNDER_FEATURE_DAYS,
  FOUNDER_LISTING_LIMIT,
  FOUNDER_MIN_LIVE_ITEMS,
  FOUNDER_QUALIFY_DAYS,
  FOUNDERS_CAP,
} from "@/lib/launch";

const COMMISSION_ANSWER =
  "En pago directo, no: tu cliente te paga a ti y Plaza Volcanes no toca ese dinero, así que no hay nada sobre qué cobrar ni nada que retener.";
const TERMS_NOTE =
  "Cualquier cambio a la política general se publica en los Términos para vendedores antes de aplicarse.";

const FOUNDERS_QUESTION = {
  question: "¿Qué incluye ser tienda fundadora?",
  answer: `Las primeras ${FOUNDERS_CAP} tiendas que publiquen ${FOUNDER_MIN_LIVE_ITEMS} productos en sus primeros ${FOUNDER_QUALIFY_DAYS} días reciben ${FOUNDER_LISTING_LIMIT} productos en vivo, la insignia permanente de Tienda fundadora, ${FOUNDER_FEATURE_DAYS} días en la rotación de la portada, 0% comisión fija ${FOUNDER_COMMISSION_LOCK_MONTHS} meses y acceso anticipado a las nuevas herramientas para vender. Registrarte no aparta un lugar: se gana publicando, y tus días cuentan desde que aprobamos tu tienda.`,
};

const MONTH_13 = {
  question: `¿Qué pasa en el mes ${FOUNDER_COMMISSION_LOCK_MONTHS + 1}?`,
  answer: `Conservas tus ${FOUNDER_LISTING_LIMIT} productos y tu insignia. Lo único que termina es la comisión fija: pasas a la política general de los Términos para vendedores, la misma para todas las tiendas. Hoy el pago directo no tiene comisión. ${TERMS_NOTE}`,
};

function questionsFor(promoActive: boolean) {
  return [
    ...(promoActive ? [FOUNDERS_QUESTION] : []),
    {
      question: "¿Cobran comisión?",
      answer: promoActive
        ? `${COMMISSION_ANSWER} Las tiendas fundadoras tienen además 0% comisión fija ${FOUNDER_COMMISSION_LOCK_MONTHS} meses en cualquier cargo de la plaza. ${TERMS_NOTE}`
        : `${COMMISSION_ANSWER} ${TERMS_NOTE}`,
    },
    {
      question: "¿Cuántos productos puedo publicar?",
      answer: `${BASE_LISTING_LIMIT} productos en vivo, gratis y sin costo por publicar.${
        promoActive ? ` Las tiendas fundadoras publican hasta ${FOUNDER_LISTING_LIMIT}.` : ""
      } El nivel de tu tienda muestra la calidad de tu servicio; hoy no cambia tu límite.`,
    },
    {
      question: "¿Quién compra aquí?",
      answer:
        "Personas en México que buscan productos nuevos y usados de tiendas independientes. Exploran sin cuenta, filtran por estado y te envían una solicitud de pedido cuando quieren comprar. Tus productos también pueden aparecer en buscadores.",
    },
    {
      question: "¿Cómo recibo mi dinero?",
      answer:
        "Directo de tu cliente. Acuerdan juntos el método de pago y Plaza Volcanes no procesa ni retiene ese dinero, así que no hay retenciones.",
    },
    {
      question: "¿Y si el cliente desaparece?",
      answer:
        "Tú decides cuándo entregar: no envíes hasta recibir el pago que acordaron. Si el cliente deja de responder, cancelas el pedido desde tu panel. Mensajes, acuerdos, envío y entrega quedan por escrito en el pedido, y si hay una aclaración, administración registra una resolución.",
    },
    {
      question: "¿Y si una publicación es un fraude?",
      answer:
        "Cada tienda nueva pasa por revisión antes de que sus productos se vean, y administración puede desactivar productos y tiendas. Cualquier persona puede reportarlo en Quejas y aclaraciones.",
    },
    ...(promoActive ? [MONTH_13] : []),
    {
      question: "¿Puedo irme cuando quiera?",
      answer:
        "Sí. No hay permanencia ni cargo por salir: retiras tus productos cuando quieras y, si tu tienda no tiene pedidos, la eliminas desde sus ajustes con sus productos e imágenes. Los pedidos que ya hiciste se conservan como registro para ti y tus clientes.",
    },
  ];
}

/**
 * #preguntas: a native exclusive accordion (<details name>), so the browser
 * announces each item's state and handles the keyboard. The first item opens
 * by default. It answers the objections sellers actually raise. `promoActive`
 * false drops the founders questions (what it includes, month 13).
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
              className="tap-halo font-bold text-brand underline decoration-accent decoration-[3px] underline-offset-4"
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
