"use client";

import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Guardando…" : "Guardar nombre"}
    </Button>
  );
}

export function DisplayNameForm({
  action,
  displayName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  displayName: string | null;
}) {
  const [state, formAction] = useFormAction(action);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {displayName ? null : (
        <p className="rounded-2xl bg-accent/45 px-4 py-3 text-sm font-medium text-brand-hover" role="status">
          Agrega tu nombre para que las tiendas sepan con quién hablan.
        </p>
      )}

      <Field
        autoComplete="name"
        defaultValue={state.values?.display_name ?? displayName ?? ""}
        error={state.errors?.display_name?.[0]}
        label="Tu nombre"
        maxLength={40}
        minLength={2}
        name="display_name"
        placeholder="Ana Ruiz"
        required
        type="text"
      />
      <p className="text-xs text-muted">
        Solo lo ven las tiendas con las que conversas. No aparece en tu perfil ni en el catálogo.
      </p>

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
