export const SIGNUP_STEPS = ["inicio", "comprar", "vender", "formulario"] as const;

export type SignupStep = (typeof SIGNUP_STEPS)[number];

function isSignupStep(value: unknown): value is SignupStep {
  return typeof value === "string" && (SIGNUP_STEPS as readonly string[]).includes(value);
}

/**
 * Picks the screen /registro shows. Somebody in the middle of a task — a purchase
 * waiting on the account, or a page to resume — already knows why they are here,
 * so they land on the form unless they asked for the guide on purpose.
 */
export function resolveSignupStep(paso: unknown, resumingTask: boolean): SignupStep {
  if (isSignupStep(paso)) return paso;
  return resumingTask ? "formulario" : "inicio";
}

/** A link to one onboarding screen that keeps an already validated continuation. */
export function signupStepHref(step: SignupStep, continuar?: string) {
  const params = new URLSearchParams({ paso: step });
  if (continuar) params.set("continuar", continuar);
  return `/registro?${params}`;
}
