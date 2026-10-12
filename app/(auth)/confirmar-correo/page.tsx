import type { Metadata } from "next";

import { PasswordForm } from "@/components/auth/password-form";
import { resolveAuthIntent } from "@/lib/auth-intent";
import { safeContinuation } from "@/lib/safe-continuation";

export const metadata: Metadata = { title: "Reenviar confirmación" };

type SearchParams = Promise<{ continuar?: string | string[]; intent?: string | string[]; vender?: string | string[] }>;

export default async function ConfirmationPage({ searchParams }: { searchParams: SearchParams }) {
  const { continuar, intent, vender } = await searchParams;
  return (
    <>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">Confirma tu correo</h1>
      <p className="mb-8 mt-3 leading-7 text-muted">
        Si tu enlace expiró y todavía no puedes ingresar, pide un correo nuevo.
        Usa el enlace más reciente. Si ya confirmaste tu correo, vuelve a ingresar con tu contraseña.
      </p>
      <PasswordForm
        continuar={safeContinuation(continuar) ?? undefined}
        intent={resolveAuthIntent(intent, vender)}
        mode="confirmation"
      />
    </>
  );
}
