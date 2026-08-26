import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { readPurchaseIntent } from "@/lib/purchase-intent.server";
import { safeContinuation } from "@/lib/safe-continuation";

export const metadata: Metadata = { title: "Crear cuenta" };

const PURCHASE_NOTICE = "Ingresa o crea tu cuenta para continuar tu compra.";

type SignUpSearchParams = Promise<{ continuar?: string | string[] }>;

export default async function SignUpPage({ searchParams }: { searchParams: SignUpSearchParams }) {
  const { continuar } = await searchParams;
  const pendingPurchase = await readPurchaseIntent();
  const destination = safeContinuation(continuar) ?? undefined;

  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu lugar empieza aquí</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">Abre tu cuenta</h1>
      <p className="mb-8 mt-3 leading-7 text-muted">Un correo, una contraseña y ya puedes crear tu primera tienda.</p>
      {pendingPurchase ? (
        <p
          className="mb-6 rounded-2xl bg-accent/45 px-4 py-3 text-sm font-medium text-brand-hover"
          role="status"
        >
          {PURCHASE_NOTICE}
        </p>
      ) : null}
      <AuthForm continuar={destination} mode="signup" />
    </>
  );
}
