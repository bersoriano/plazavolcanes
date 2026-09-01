"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

import { requestPasswordReset, updatePassword } from "@/lib/actions/auth";
import { useFormAction } from "@/lib/use-form-action";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

type PasswordFormMode = "request" | "update";

function SubmitButton({ mode }: { mode: PasswordFormMode }) {
  const { pending } = useFormStatus();
  const label = mode === "request" ? "Enviar enlace" : "Guardar contraseña";

  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? "Procesando…" : label}
    </Button>
  );
}

export function PasswordForm({ mode }: { mode: PasswordFormMode }) {
  const action = mode === "request" ? requestPasswordReset : updatePassword;
  const [state, formAction] = useFormAction(action);
  const requesting = mode === "request";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {requesting ? (
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
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton mode={mode} />

      {requesting ? (
        <p className="text-center text-sm text-muted">
          <Link
            className="inline-flex min-h-11 items-center font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
            href="/ingresar"
          >
            Volver a ingresar
          </Link>
        </p>
      ) : null}
    </form>
  );
}
