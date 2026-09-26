import { Accent, Eyebrow, TYPE } from "@/components/home/landing/primitives";
import { MoneyFlow } from "@/components/sellers/money-flow";
import { ReputationFlow } from "@/components/sellers/reputation-flow";
import { REPUTATION_IMPORT_AVAILABLE } from "@/lib/launch";

/**
 * Por qué vender aquí: two reasons, each with a small drawing of it. The
 * payment going straight to the store, and the reputation coming with it.
 */
export function SellerBenefits() {
  return (
    <section
      aria-labelledby="beneficios-heading"
      className="px-5 pb-16 pt-14 sm:px-8 lg:pb-20 lg:pt-20 xl:px-20"
      id="beneficios"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:gap-11">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-3.5 lg:gap-4">
            <Eyebrow>Por qué vender aquí</Eyebrow>
            <h2 className={`${TYPE.h2} text-ink`} id="beneficios-heading">
              Hecho para quien vende <Accent>por su cuenta.</Accent>
            </h2>
          </div>
          <p className={`${TYPE.aside} lg:max-w-[400px] lg:pb-2`}>
            Plaza Volcanes es una plaza para tiendas independientes de México. Tú pones los productos y el trato
            con tus clientes; nosotros, la vitrina.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          <ReasonCard
            eyebrow="01 · Sin retenciones ni comisiones"
            text="Con el método que acuerden. Plaza Volcanes no procesa, no retiene y no descuenta nada de tu venta."
            title={
              <>
                Tu cliente te paga <Accent>directo a ti.</Accent>
              </>
            }
          >
            <MoneyFlow />
          </ReasonCard>
          {REPUTATION_IMPORT_AVAILABLE ? (
            <ReasonCard
              eyebrow="02 · Reputación"
              text="¿Ya tienes ventas y buenas calificaciones en otro lado? Tus nuevos clientes las verán desde el primer día."
              title={
                <>
                  Trae la confianza que <Accent>ya ganaste.</Accent>
                </>
              }
            >
              <ReputationFlow />
            </ReasonCard>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ReasonCard({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-6 rounded-[26px] border border-line bg-surface p-5 sm:p-7 lg:min-h-[460px] lg:rounded-[32px] lg:p-9">
      <div className="flex flex-col gap-3">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted lg:text-[13px]">{eyebrow}</p>
        <h3 className="font-display text-[28px] font-semibold leading-[1.02] tracking-[-0.03em] lg:text-[36px]">{title}</h3>
        <p className="text-[15px] leading-[1.55] text-muted lg:text-[16px]">{text}</p>
      </div>
      {children}
    </article>
  );
}
