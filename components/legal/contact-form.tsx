"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { submitContactMessage } from "@/lib/actions/contact";
import { useFormAction } from "@/lib/use-form-action";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Enviando…" : "Enviar mensaje"}
    </Button>
  );
}

/**
 * How anyone writes to the plaza. A visitor leaves how to answer them; a
 * signed-in person writes only the message, because the account already says.
 */
export function ContactForm({ signedIn }: { signedIn: boolean }) {
  // A new key starts a clean form once a message has gone.
  const [attempt, setAttempt] = useState(0);

  return (
    <ContactAttempt
      key={attempt}
      onRestart={() => setAttempt((value) => value + 1)}
      signedIn={signedIn}
    />
  );
}

function ContactAttempt({ onRestart, signedIn }: { onRestart: () => void; signedIn: boolean }) {
  const [state, formAction] = useFormAction(submitContactMessage);

  if (state.status === "success") {
    return (
      <Card padding="md" className="space-y-4 rounded-[1.5rem]">
        <p className="leading-7 text-ink" role="status">
          {state.message}
        </p>
        <Button onClick={onRestart} variant="secondary">
          Escribir otro mensaje
        </Button>
      </Card>
    );
  }

  const messageError = state.errors?.message?.[0];

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {signedIn ? (
        <p className="text-sm leading-6 text-muted">
          Te responderemos usando los datos de contacto de tu cuenta.
        </p>
      ) : (
        <>
          <Field
            autoComplete="name"
            defaultValue={state.values?.name}
            error={state.errors?.name?.[0]}
            label="Nombre"
            maxLength={120}
            name="name"
            required
            type="text"
          />
          <Field
            autoComplete="email"
            defaultValue={state.values?.email}
            error={state.errors?.email?.[0]}
            label="Correo electrónico"
            maxLength={254}
            name="email"
            placeholder="tu@correo.com"
            required
            type="email"
          />
          <Field
            autoComplete="tel-national"
            defaultValue={state.values?.phone}
            error={state.errors?.phone?.[0]}
            hint="10 dígitos."
            inputMode="numeric"
            label="Teléfono móvil"
            maxLength={16}
            name="phone"
            placeholder="33 1234 5678"
            required
            type="tel"
          />
        </>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-ink" htmlFor="contact-message">
          Mensaje
        </label>
        <Textarea
          aria-describedby={messageError ? "contact-message-error" : undefined}
          aria-invalid={Boolean(messageError)}
          className="min-h-40 leading-7"
          defaultValue={state.values?.message}
          id="contact-message"
          maxLength={2000}
          name="message"
          placeholder="Cuéntanos qué pasó y, si aplica, el número de pedido."
          required
        />
        {messageError ? (
          <p className="text-sm font-medium text-sale" id="contact-message-error">
            {messageError}
          </p>
        ) : null}
      </div>

      {/* A trap for scripts that fill every field: no person sees or reaches it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Sitio web</label>
        <input autoComplete="off" id="contact-website" name="website" tabIndex={-1} type="text" />
      </div>

      {state.message ? (
        <p className="text-sm font-medium text-sale" role="status">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <SubmitButton />
        <p className="text-xs leading-5 text-muted">
          Usamos estos datos solo para responder tu mensaje.{" "}
          <Link className="font-semibold text-brand underline underline-offset-4" href="/privacidad">
            Aviso de privacidad
          </Link>
        </p>
      </div>
    </form>
  );
}
