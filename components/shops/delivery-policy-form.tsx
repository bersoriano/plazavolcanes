"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";

type DeliveryPolicyFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  policy: string;
  /** ISO date the field opens again, or null when it can be written now. */
  unlocksAt: string | null;
};

function OpenConfirmButton({ onOpen }: { onOpen: () => void }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} onClick={onOpen} type="button">
      {pending ? "Guardando…" : "Guardar política de entregas"}
    </Button>
  );
}

export function DeliveryPolicyForm({ action, policy, unlocksAt }: DeliveryPolicyFormProps) {
  const [state, formAction] = useFormAction(action);
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const opensOn = unlocksAt ? formatDate(unlocksAt) : null;

  // The confirmation is the last thing the seller reads before a month-long
  // commitment, so it takes the focus rather than waiting to be found.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  return (
    <form
      action={(formData: FormData) => {
        // Confirmed: the answer is in, so the question goes away and the form
        // itself reports what happened next.
        setConfirming(false);
        formAction(formData);
      }}
      className="space-y-3"
      noValidate
    >
      <label className="block text-sm font-semibold text-ink" htmlFor="delivery_policy">
        Política de entregas
      </label>
      <p className="text-sm leading-6 text-muted" id="delivery-policy-help">
        Escribe cómo envías y cómo entregas en persona. Quien compre la verá en tu tienda pública.
      </p>
      <textarea
        aria-describedby="delivery-policy-help"
        aria-invalid={Boolean(state.errors?.delivery_policy)}
        className="min-h-36 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-background disabled:text-muted"
        defaultValue={state.values?.delivery_policy ?? policy}
        disabled={Boolean(opensOn)}
        id="delivery_policy"
        maxLength={1200}
        name="delivery_policy"
        placeholder="Cómo envías, a dónde llegas en persona, cuánto tardas y qué necesitas de quien compra."
      />
      {state.errors?.delivery_policy?.[0] ? (
        <p className="text-sm font-medium text-sale">{state.errors.delivery_policy[0]}</p>
      ) : null}

      {state.message ? (
        <p
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${state.status === "success" ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      {opensOn ? (
        <p className="rounded-2xl bg-background px-4 py-3 text-sm leading-6 text-muted">
          Ya cambiaste tu política este mes. Podrás editarla el {opensOn}.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted">
            Solo puedes cambiarla una vez al mes, así que revísala antes de guardar.
          </p>
          <div className="flex justify-end">
            <OpenConfirmButton onOpen={() => setConfirming(true)} />
          </div>
        </>
      )}

      {/* Kept inside the form so confirming is an ordinary submit: no second
          form, no programmatic submission to keep in step with this one. */}
      {confirming ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5">
          <div
            aria-labelledby="delivery-policy-confirm-title"
            aria-modal="true"
            className="w-full max-w-md rounded-[1.75rem] border border-line bg-surface p-6 shadow-xl outline-none"
            onKeyDown={(event) => {
              if (event.key === "Escape") setConfirming(false);
            }}
            ref={confirmRef}
            role="dialog"
            tabIndex={-1}
          >
            <h3 className="font-display text-xl font-semibold" id="delivery-policy-confirm-title">
              ¿Guardar tu política de entregas?
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted">
              Solo puedes cambiarla una vez al mes. Si guardas ahora, podrás editarla de nuevo
              dentro de 30 días.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button onClick={() => setConfirming(false)} type="button" variant="secondary">
                Cancelar
              </Button>
              <Button type="submit">Sí, guardar</Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
