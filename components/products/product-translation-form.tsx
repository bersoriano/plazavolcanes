"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

type ProductTranslationFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  translation?: {
    name: string;
    description: string;
  } | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Guardando…" : "Guardar versión en inglés"}
    </Button>
  );
}

export function ProductTranslationForm({ action, translation }: ProductTranslationFormProps) {
  const [state, formAction] = useFormAction(action);

  return (
    <section className="mt-8 border-t border-line pt-8">
      <details>
        <summary className="cursor-pointer font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
          Agregar versión en inglés
        </summary>
        <p className="mt-2 text-sm leading-6 text-muted">
          Esta versión es opcional. Completa ambos campos o déjalos vacíos para eliminarla.
        </p>
        <form action={formAction} className="mt-6 space-y-5" noValidate>
        <Field
          error={state.errors?.name?.[0]}
          label="Nombre en inglés"
          maxLength={120}
          defaultValue={state.values?.name ?? translation?.name}
          name="name"
          placeholder="Clay coffee mug"
        />
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="english-description">
            Descripción en inglés
          </label>
          <textarea
            aria-describedby={state.errors?.description ? "english-description-error" : undefined}
            aria-invalid={Boolean(state.errors?.description)}
            className="min-h-36 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
            id="english-description"
            maxLength={3000}
            defaultValue={state.values?.description ?? translation?.description}
            name="description"
            placeholder="Materials, process, dimensions, and other useful details."
          />
          {state.errors?.description?.[0] ? (
            <p className="text-sm font-medium text-sale" id="english-description-error">
              {state.errors.description[0]}
            </p>
          ) : null}
        </div>
        {state.message ? (
          <p
            className={`rounded-2xl px-4 py-3 text-sm font-medium ${state.status === "success" ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"}`}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
        <div className="flex justify-end">
          <SubmitButton />
        </div>
        </form>
      </details>
    </section>
  );
}
