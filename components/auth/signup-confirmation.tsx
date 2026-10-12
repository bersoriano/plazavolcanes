"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useEffect, useRef } from "react";

import { PasswordForm } from "@/components/auth/password-form";
import { signupStepHref } from "@/lib/signup-onboarding";

export function SignupConfirmation({ email, message, continuar, intent, onRestart }: {
  email: string;
  message: string;
  continuar?: string;
  intent?: "vender";
  onRestart: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView?.({ block: "center" });
  }, []);

  return (
    <section aria-labelledby="confirmation-title" className="space-y-5">
      <MailCheck aria-hidden="true" className="size-10 text-brand" />
      <h1 ref={heading} tabIndex={-1} id="confirmation-title" className="scroll-mt-24 font-display text-3xl font-semibold tracking-[-0.04em] text-ink">Confirma tu correo</h1>
      <p className="rounded-2xl bg-accent/45 px-4 py-3 text-sm font-medium text-brand-hover" role="status">{message}</p>
      <p className="text-muted">Correo de destino: <strong className="break-all text-ink">{email}</strong></p>
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
        <li>Abre el correo de Plaza Volcanes y selecciona «Confirmar mi correo».</li>
        <li>Revisa también spam o correo no deseado. El envío puede tardar unos minutos.</li>
        <li>Al confirmar, continuarás donde te quedaste. Si ya confirmaste o el enlace no inicia tu sesión, ingresa con tu contraseña.</li>
      </ol>
      <PasswordForm mode="confirmation" email={email} continuar={continuar} intent={intent} />
      <Link className="inline-flex min-h-11 items-center font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4" href={signupStepHref("formulario", continuar, intent)} onClick={onRestart}>
        Corregir correo o empezar de nuevo
      </Link>
      <p className="text-xs leading-5 text-muted">Volver al registro permite usar el correo correcto; no modifica una cuenta existente.</p>
    </section>
  );
}
