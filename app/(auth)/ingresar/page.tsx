import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { readPurchaseIntent } from "@/lib/purchase-intent.server";
import { safeContinuation } from "@/lib/safe-continuation";

export const metadata: Metadata = { title: "Ingresar" };

// Routes that fail send people here with a reason. Without these the redirect
// looks like the sign-in page reloading itself for no reason.
const NOTICES: Record<string, string> = {
  recuperacion: "Ese enlace ya no sirve. Pide uno nuevo para crear tu contraseña.",
  confirmacion: "No pudimos confirmar tu cuenta con ese enlace. Inténtalo de nuevo.",
  configuracion: "El acceso no está configurado todavía. Inténtalo más tarde.",
};

const PURCHASE_NOTICE = "Ingresa o crea tu cuenta para continuar tu compra.";

type SignInSearchParams = Promise<{ error?: string | string[]; continuar?: string | string[] }>;

export default async function SignInPage({ searchParams }: { searchParams: SignInSearchParams }) {
  const { error, continuar } = await searchParams;
  // A pending purchase is the reason most signed-out buyers arrive here, and it
  // outranks whatever a redirect put in the query string.
  const pendingPurchase = await readPurchaseIntent();
  const notice = pendingPurchase
    ? PURCHASE_NOTICE
    : typeof error === "string"
      ? NOTICES[error]
      : undefined;
  const destination = safeContinuation(continuar) ?? undefined;

  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Bienvenido de vuelta</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">Entra a tu plaza</h1>
      <p className="mb-8 mt-3 leading-7 text-muted">Administra tus tiendas y mantén tus productos al día.</p>
      {notice ? (
        <p
          className={`mb-6 rounded-2xl px-4 py-3 text-sm font-medium ${
            pendingPurchase ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"
          }`}
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <AuthForm continuar={destination} mode="signin" />
    </>
  );
}
