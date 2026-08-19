"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, signUp } from "@/lib/actions/auth";
import { initialActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

function SubmitButton({ mode }: { mode: "signin" | "signup" }) {
  const { pending } = useFormStatus();
  const label = mode === "signin" ? "Ingresar" : "Crear cuenta";

  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? "Procesando…" : label}
    </Button>
  );
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction] = useActionState(action, initialActionState);
  const signingIn = mode === "signin";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field
        autoComplete="email"
        error={state.errors?.email?.[0]}
        label="Correo electrónico"
        name="email"
        placeholder="tu@correo.com"
        required
        type="email"
      />
      <Field
        autoComplete={signingIn ? "current-password" : "new-password"}
        error={state.errors?.password?.[0]}
        label="Contraseña"
        minLength={8}
        name="password"
        placeholder="Mínimo 8 caracteres"
        required
        type="password"
      />

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

      <p className="text-center text-sm text-muted">
        {signingIn ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
        <Link
          className="font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
          href={signingIn ? "/registro" : "/ingresar"}
        >
          {signingIn ? "Regístrate" : "Ingresa"}
        </Link>
      </p>
    </form>
  );
}
