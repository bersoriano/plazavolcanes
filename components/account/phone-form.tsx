"use client";

import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Guardando…" : "Guardar teléfono"}
    </Button>
  );
}

export function PhoneForm({
  action,
  phone,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  phone: string | null;
}) {
  const [state, formAction] = useFormAction(action);
  // Accounts created before the phone requirement have nothing stored yet.
  const nationalNumber = phone?.replace(/^\+52/, "") ?? "";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {nationalNumber ? null : (
        <p className="rounded-2xl bg-accent/45 px-4 py-3 text-sm font-medium text-brand-hover" role="status">
          Agrega tu teléfono móvil para completar tu cuenta.
        </p>
      )}

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
            defaultValue={state.values?.phone ?? nationalNumber}
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
          <p className="text-xs text-muted">Solo tú puedes verlo. Lo usamos para contactarte sobre tus pedidos.</p>
        )}
      </div>

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
