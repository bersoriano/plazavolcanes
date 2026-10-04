"use client";

import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Guardando…" : "Guardar avisos"}
    </Button>
  );
}

export function EmailNotificationsForm({
  action,
  email,
  enabled,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  email: string | null;
  enabled: boolean;
}) {
  const [state, formAction] = useFormAction(action);

  return (
    <form action={formAction} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">Avisos por correo</legend>
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <input className="mt-1 size-4 accent-brand" defaultChecked={enabled} name="email_enabled" type="checkbox" />
          <span className="text-sm leading-6 text-ink">
            Avísame por correo de solicitudes de compra, mensajes de compradores y solicitudes por vencer en mis tiendas.
          </span>
        </label>
        <p className="text-xs text-muted">
          {email ? `Te escribimos a ${email}. ` : ""}Los correos no incluyen el texto de los mensajes; los lees en Plaza Volcanes.
        </p>
      </fieldset>

      {state.message ? (
        <p
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            state.status === "success" ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"
          }`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <SaveButton />
    </form>
  );
}
