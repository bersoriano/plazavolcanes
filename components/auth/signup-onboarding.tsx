import Link from "next/link";
import { ArrowLeft, ArrowRight, ShoppingBag, Store, type LucideIcon } from "lucide-react";

import { buyerSteps } from "@/components/home/buyer-steps";
import { sellerSteps } from "@/components/sellers/seller-program";
import { signupStepHref } from "@/lib/signup-onboarding";

const textLink =
  "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4";

const quietLink =
  "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand";

const choices = [
  {
    step: "comprar",
    icon: ShoppingBag,
    title: "Quiero comprar",
    description: "Encuentra productos de tiendas independientes y pídelos.",
  },
  {
    step: "vender",
    icon: Store,
    title: "Quiero vender",
    description: "Abre tu tienda y recibe solicitudes de pedido.",
  },
] as const;

const flows = {
  comprar: {
    eyebrow: "Para quien compra",
    title: "Así se compra",
    intro: "No necesitas cuenta para mirar. La pides cuando quieras enviar tu primera solicitud de pedido.",
    steps: buyerSteps,
    note: "El pago y la entrega los acuerdas directamente con la tienda. Plaza Volcanes no procesa ni retiene fondos.",
    other: { step: "vender", label: "Ver cómo se vende" },
  },
  vender: {
    eyebrow: "Para quien vende",
    title: "Así se vende",
    intro: "Las primeras 100 tiendas que se registren durante los primeros tres meses pueden publicar gratis y no pagan comisión por cada artículo vendido.",
    steps: sellerSteps,
    note: "Tú y la persona compradora acuerdan el pago y la entrega directamente. Plaza Volcanes no procesa ni retiene fondos.",
    other: { step: "comprar", label: "Ver cómo se compra" },
  },
} as const;

type FlowStep = keyof typeof flows;

function SkipLink({ continuar }: { continuar?: string }) {
  return (
    <Link className={quietLink} href={signupStepHref("formulario", continuar)}>
      Saltar e ir al registro
    </Link>
  );
}

/** The first screen: somebody says which side of the plaza they came for. */
export function SignupChoice({ continuar }: { continuar?: string }) {
  const signInHref = continuar ? `/ingresar?continuar=${encodeURIComponent(continuar)}` : "/ingresar";

  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu lugar empieza aquí</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">
        ¿Qué te trae a la plaza?
      </h1>
      <p className="mt-3 leading-7 text-muted">
        Te contamos cómo funciona antes de pedirte datos. Puedes ver los dos lados.
      </p>

      <div className="mt-8 space-y-3">
        {choices.map((choice) => (
          <ChoiceCard continuar={continuar} key={choice.step} {...choice} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 border-t border-line pt-4">
        <SkipLink continuar={continuar} />
        <p className="text-sm text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link className={textLink} href={signInHref}>
            Ingresa
          </Link>
        </p>
      </div>
    </>
  );
}

function ChoiceCard({
  continuar,
  description,
  icon: Icon,
  step,
  title,
}: {
  continuar?: string;
  description: string;
  icon: LucideIcon;
  step: FlowStep;
  title: string;
}) {
  const titleId = `eleccion-${step}`;
  const descriptionId = `eleccion-${step}-detalle`;

  return (
    <Link
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="group flex items-center gap-4 rounded-[1.5rem] border border-line bg-background p-5 transition-colors hover:border-brand focus-visible:border-brand"
      href={signupStepHref(step, continuar)}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-accent">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-semibold tracking-[-0.02em] text-ink" id={titleId}>
          {title}
        </span>
        <span className="mt-1 block text-sm leading-6 text-muted" id={descriptionId}>
          {description}
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="size-5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/** One side of the plaza, step by step, with a way back and a way across. */
export function SignupFlow({ continuar, flow }: { continuar?: string; flow: FlowStep }) {
  const { eyebrow, intro, note, other, steps, title } = flows[flow];

  return (
    <>
      <div className="-mt-2 flex items-center justify-between gap-4">
        <Link className={quietLink} href={signupStepHref("inicio", continuar)}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver
        </Link>
        <SkipLink continuar={continuar} />
      </div>

      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">{title}</h1>
      <p className="mt-3 leading-7 text-muted">{intro}</p>

      <ol className="mt-8">
        {steps.map((step, index) => (
          <li className="relative flex gap-4 pb-6 last:pb-0" key={step.title}>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="absolute bottom-0 left-5 top-12 w-px -translate-x-1/2 bg-line" />
            ) : null}
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-accent">
              <step.icon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Paso {index + 1}</p>
              <h2 className="mt-1 font-display text-lg font-semibold tracking-[-0.02em] text-ink">{step.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-8 rounded-2xl bg-accent/45 px-4 py-3 text-sm leading-6 text-brand-hover">{note}</p>

      <Link
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-7 font-semibold text-white transition-colors hover:bg-brand-hover"
        href={signupStepHref("formulario", continuar)}
      >
        Crear mi cuenta
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      <p className="mt-3 text-center">
        <Link className={textLink} href={signupStepHref(other.step, continuar)}>
          {other.label}
        </Link>
      </p>
    </>
  );
}
