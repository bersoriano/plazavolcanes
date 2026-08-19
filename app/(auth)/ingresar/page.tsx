import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function SignInPage() {
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Bienvenido de vuelta</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">Entra a tu plaza</h1>
      <p className="mb-8 mt-3 leading-7 text-muted">Administra tus tiendas y mantén tus productos al día.</p>
      <AuthForm mode="signin" />
    </>
  );
}
