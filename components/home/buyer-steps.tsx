import Link from "next/link";
import { ArrowRight, ClipboardCheck, Compass, HandHeart } from "lucide-react";

export const buyerSteps = [
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
      className="border-y border-line bg-surface px-5 py-16 sm:px-8 lg:py-28"
    >
      {/* The /vender steps pattern: on a phone the header, the steps and the
          button stack; at lg the button sits beside the header. */}
      <div className="mx-auto flex max-w-[1200px] flex-col gap-7 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:gap-x-10 lg:gap-y-14">
        <div className="flex max-w-[760px] flex-col gap-3.5 lg:gap-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand lg:text-[13px]">
            Compra con confianza
          </p>
          <h2
            className="text-balance font-display text-[38px] font-medium leading-[1.02] tracking-[-0.03em] text-ink lg:text-[60px]"
            id="comprar-heading"
          >
            Cómo comprar <em className="italic text-brand">en la plaza.</em>
          </h2>
          <p className="text-[16px] leading-[1.6] text-muted lg:text-[18px]">
            No necesitas cuenta para explorar productos. La pides cuando quieras enviar tu primera solicitud de
            pedido.
          </p>
        </div>

        <Link
          className="order-3 flex h-14 shrink-0 items-center justify-center gap-2.5 rounded-full bg-brand text-[17px] font-bold text-white transition-colors hover:bg-brand-hover lg:order-none lg:px-7"
          href={catalogHref}
        >
          Ver productos
          <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.2} />
        </Link>

        <div className="relative order-2 lg:order-none lg:col-span-2">
          <div
            aria-hidden="true"
            className="absolute bottom-24 left-[25px] top-[52px] border-l-2 border-dashed border-line lg:hidden"
          />
          <ol className="relative flex flex-col gap-7 lg:grid lg:grid-cols-3 lg:gap-6">
            {buyerSteps.map((step, index) => (
              <li
                className="relative grid content-start grid-cols-[52px_minmax(0,1fr)] items-start gap-x-[18px] gap-y-1.5 [grid-template-areas:'tile_paso''tile_title''tile_body'] lg:grid-cols-[56px_minmax(0,1fr)] lg:gap-x-4 lg:gap-y-[18px] lg:rounded-[1.75rem] lg:border lg:border-line/60 lg:bg-background lg:p-8 lg:[grid-template-areas:'tile_paso''title_title''body_body']"
                key={step.title}
              >
                <span
                  aria-hidden="true"
                  className="grid size-[52px] shrink-0 place-items-center self-start rounded-2xl bg-brand text-accent [grid-area:tile] lg:size-14 lg:self-center"
                >
                  <step.icon className="size-6 lg:size-[26px]" strokeWidth={1.8} />
                </span>
                <span className="self-center text-[12px] font-bold tracking-[0.16em] text-brand [grid-area:paso] lg:text-[14px]">
                  PASO {index + 1}
                </span>
                <h3 className="font-display text-[23px] font-semibold leading-[1.15] tracking-[-0.015em] text-ink [grid-area:title] lg:text-[28px] lg:leading-[1.1] lg:tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="text-[15px] leading-[1.6] text-muted [grid-area:body] lg:text-[16px]">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
