"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

import { signIn, signUp } from "@/lib/actions/auth";
import { useFormAction } from "@/lib/use-form-action";
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
  const [state, formAction] = useFormAction(action);
  const signingIn = mode === "signin";

  return (
    <form action={formAction} className="space-y-5" noValidate>
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
      {signingIn ? null : (
        <Field
          autoComplete="name"
          defaultValue={state.values?.display_name}
          error={state.errors?.display_name?.[0]}
          label="Tu nombre"
          maxLength={40}
          minLength={2}
          name="display_name"
          placeholder="Ana Ruiz"
          required
          type="text"
        />
      )}
      {signingIn ? null : (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="phone">
            Teléfono móvil
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-brand">
            <span className="text-sm font-semibold text-muted">+52</span>
            <input
              aria-describedby={state.errors?.phone?.[0] ? "phone-error" : undefined}
              aria-invalid={Boolean(state.errors?.phone?.[0])}
              autoComplete="tel-national"
              className="min-h-12 w-full bg-transparent text-ink outline-none placeholder:text-muted/70"
              defaultValue={state.values?.phone}
              id="phone"
              inputMode="numeric"
              maxLength={16}
              name="phone"
              placeholder="33 1234 5678"
              required
              type="tel"
            />
          </div>
          {state.errors?.phone?.[0] ? (
            <p className="text-sm font-medium text-sale" id="phone-error">{state.errors.phone[0]}</p>
          ) : (
            <p className="text-xs text-muted">Lo usamos para contactarte sobre tus pedidos. No es público.</p>
          )}
        </div>
      )}
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

      {signingIn ? (
        <p className="text-right text-sm">
          <Link
            className="font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
            href="/recuperar"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      ) : null}

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
