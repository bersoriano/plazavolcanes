"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { requestPasswordReset, resendConfirmation, updatePassword } from "@/lib/actions/auth";
import { useFormAction } from "@/lib/use-form-action";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { safeContinuation } from "@/lib/safe-continuation";
import type { ActionState } from "@/lib/action-state";

type PasswordFormMode = "request" | "update" | "confirmation";

export function PasswordForm({ mode, continuar, intent, email }: { mode: PasswordFormMode; continuar?: string; intent?: "vender"; email?: string }) {
  continuar = safeContinuation(continuar) ?? undefined;
  const [retryAt, setRetryAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const action = mode === "confirmation" ? resendConfirmation : mode === "request" ? requestPasswordReset : updatePassword;
  const [state, formAction, pending] = useFormAction(async (previous, data): Promise<ActionState> => {
    if (mode !== "confirmation") return action(previous, data);
    let invalidEmail = false;
    try {
      const result = await action(previous, data);
      invalidEmail = Boolean(result.errors?.email?.length);
      return result;
    } catch {
      return { status: "error", message: "No pudimos procesar la solicitud. Espera un minuto e inténtalo de nuevo, o vuelve a ingresar si ya confirmaste." };
    } finally {
      // Same cooldown for every valid address and provider outcome; never reveal account status.
      // Invalid email syntax makes no provider request and can be corrected immediately.
      if (!invalidEmail) {
        setSeconds(60);
        setRetryAt(Date.now() + 60_000);
      }
    }
  });
  useEffect(() => {
    if (!retryAt) return;
    const update = () => setSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const requesting = mode !== "update";
  const params = new URLSearchParams();
  if (continuar) params.set("continuar", continuar);
  if (intent) params.set("intent", intent);

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5" noValidate>
      {continuar ? <input name="continuar" type="hidden" value={continuar} /> : null}
      {intent ? <input name="intent" type="hidden" value={intent} /> : null}
      {requesting && email ? <input name="email" type="hidden" value={email} /> : requesting ? (
        <Field
          autoComplete="email"
          defaultValue={state.values?.email}
          error={state.errors?.email?.[0]}
          label="Correo electrónico"
          name="email"
          placeholder="tu@correo.com"
          required
          type="email"
        />
      ) : (
        <>
          <Field
            autoComplete="new-password"
            error={state.errors?.password?.[0]}
            label="Contraseña nueva"
            minLength={8}
            name="password"
            placeholder="Mínimo 8 caracteres"
            required
            type="password"
          />
          <Field
            autoComplete="new-password"
            error={state.errors?.password_confirm?.[0]}
            label="Repite la contraseña"
            minLength={8}
            name="password_confirm"
            placeholder="La misma contraseña"
            required
            type="password"
          />
        </>
      )}

      {state.message ? (
        <p
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            state.status === "success"
              ? "bg-accent/45 text-brand-hover"
              : "bg-sale/10 text-sale"
          }`}
          role={mode === "confirmation" && state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}

      {mode === "confirmation" && pending ? <p role="status" className="text-sm text-muted">Enviando solicitud de confirmación…</p> : null}
      {mode === "confirmation" && seconds > 0 ? <p className="text-sm text-muted">Espera un minuto antes de pedir otro enlace. Si no llega, revisa spam o intenta más tarde.</p> : null}
      <Button className="w-full" disabled={pending || (mode === "confirmation" && seconds > 0)} type="submit">
        {pending ? "Procesando…" : mode === "confirmation" && seconds > 0 ? `Espera ${seconds} s` : mode === "confirmation" ? "Reenviar confirmación" : mode === "request" ? "Enviar enlace" : "Guardar contraseña"}
      </Button>

      {requesting ? (
        <p className="text-center text-sm text-muted">
          <Link
            className="inline-flex min-h-11 items-center font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
            href={`/ingresar${params.size ? `?${params}` : ""}`}
          >
            Volver a ingresar
          </Link>
        </p>
      ) : null}
    </form>
  );
}
