import type { Metadata } from "next";

import { PasswordForm } from "@/components/auth/password-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPasswordPage() {
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
        ¿Olvidaste tu contraseña?
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">
        Recupera tu acceso
      </h1>
      <p className="mb-8 mt-3 leading-7 text-muted">
        Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.
      </p>
      <PasswordForm mode="request" />
    </>
  );
}
