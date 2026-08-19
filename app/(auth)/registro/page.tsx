import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tu lugar empieza aquí</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">Abre tu cuenta</h1>
      <p className="mb-8 mt-3 leading-7 text-muted">Un correo, una contraseña y ya puedes crear tu primera tienda.</p>
      <AuthForm mode="signup" />
    </>
  );
}
