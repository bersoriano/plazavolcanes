import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Ingresar" };

// Routes that fail send people here with a reason. Without these the redirect
// looks like the sign-in page reloading itself for no reason.
const NOTICES: Record<string, string> = {
  recuperacion: "Ese enlace ya no sirve. Pide uno nuevo para crear tu contraseña.",
  confirmacion: "No pudimos confirmar tu cuenta con ese enlace. Inténtalo de nuevo.",
  configuracion: "El acceso no está configurado todavía. Inténtalo más tarde.",
};

type SignInSearchParams = Promise<{ error?: string | string[] }>;

export default async function SignInPage({ searchParams }: { searchParams: SignInSearchParams }) {
  const { error } = await searchParams;
  const notice = typeof error === "string" ? NOTICES[error] : undefined;

  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Bienvenido de vuelta</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">Entra a tu plaza</h1>
      <p className="mb-8 mt-3 leading-7 text-muted">Administra tus tiendas y mantén tus productos al día.</p>
      {notice ? (
        <p
          className="mb-6 rounded-2xl bg-sale/10 px-4 py-3 text-sm font-medium text-sale"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <AuthForm mode="signin" />
    </>
  );
}
