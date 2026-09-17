import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { SignupChoice, SignupFlow } from "@/components/auth/signup-onboarding";
import { readPurchaseIntent } from "@/lib/purchase-intent.server";
import { safeContinuation } from "@/lib/safe-continuation";
import { resolveSignupStep, signupStepHref } from "@/lib/signup-onboarding";

export const metadata: Metadata = { title: "Crear cuenta" };

const PURCHASE_NOTICE = "Ingresa o crea tu cuenta para continuar tu compra.";

type SignUpSearchParams = Promise<{ continuar?: string | string[]; paso?: string | string[]; vender?: string | string[] }>;

export default async function SignUpPage({ searchParams }: { searchParams: SignUpSearchParams }) {
  const { continuar, paso, vender } = await searchParams;
  const pendingPurchase = await readPurchaseIntent();
  const destination = safeContinuation(continuar) ?? undefined;
  const sellerIntent = vender === "1";
  const step = sellerIntent && !paso ? "formulario" : resolveSignupStep(paso, Boolean(pendingPurchase || destination));

  if (step === "inicio") return <SignupChoice continuar={destination} />;
  if (step !== "formulario") return <SignupFlow continuar={destination} flow={step} />;

  return (
    <>
      <Link
        className="-mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand"
        href={signupStepHref("inicio", destination)}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Ver cómo funciona
      </Link>
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu lugar empieza aquí</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">Abre tu cuenta</h1>
      <p className="mb-8 mt-3 leading-7 text-muted">
        Crea tu cuenta con correo, contraseña, tu nombre y teléfono. Usamos tu teléfono para contactarte sobre pedidos y no es público.
      </p>
      {pendingPurchase ? (
        <p
          className="mb-6 rounded-2xl bg-accent/45 px-4 py-3 text-sm font-medium text-brand-hover"
          role="status"
        >
          {PURCHASE_NOTICE}
        </p>
      ) : null}
      <AuthForm continuar={destination} intent={sellerIntent ? "vender" : undefined} mode="signup" />
    </>
  );
}
