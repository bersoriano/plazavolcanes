"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";
import type { CategoryTree } from "@/lib/categories";

type CategorySuggestionFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  categories: CategoryTree[];
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Enviando…" : "Enviar sugerencia"}
    </Button>
  );
}

export function CategorySuggestionForm({ action, categories }: CategorySuggestionFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [state, formAction] = useFormAction(action);
  const activeRoots = categories.filter((category) => category.isActive);

  return (
    <section className="mt-6 border-t border-line pt-6">
      <button
        aria-expanded={isExpanded}
        className="text-sm font-semibold text-brand hover:text-brand-hover"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        type="button"
      >
        No encuentro mi categoría
      </button>
      {isExpanded ? (
        <form action={formAction} className="mt-4 space-y-4" noValidate>
          <p className="text-sm leading-6 text-muted">
            Cuéntanos qué categoría falta y la revisaremos antes de publicarla.
          </p>
          <Field
            error={state.errors?.suggested_name?.[0]}
            label="Categoría sugerida"
            maxLength={80}
            defaultValue={state.values?.suggested_name}
            name="suggested_name"
            required
          />
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-ink" htmlFor="suggestion-context">
              Detalles (opcional)
            </label>
            <textarea
              aria-describedby={state.errors?.context ? "suggestion-context-error" : undefined}
              aria-invalid={Boolean(state.errors?.context)}
              className="min-h-28 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
              id="suggestion-context"
              maxLength={500}
              defaultValue={state.values?.context}
              name="context"
              placeholder="Ejemplo: instrumentos para principiantes."
            />
            {state.errors?.context?.[0] ? <p className="text-sm font-medium text-sale" id="suggestion-context-error">{state.errors.context[0]}</p> : null}
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-ink" htmlFor="suggestion-root-category">
              Categoría principal (opcional)
            </label>
            <select
              aria-describedby={state.errors?.root_category_id ? "suggestion-root-category-error" : undefined}
              aria-invalid={Boolean(state.errors?.root_category_id)}
              className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink focus:border-brand focus:outline-none"
              id="suggestion-root-category"
              defaultValue={state.values?.root_category_id}
              key={`root-category-${state.values?.root_category_id ?? ""}`}
              name="root_category_id"
            >
              <option value="">Sin categoría principal</option>
              {activeRoots.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            {state.errors?.root_category_id?.[0] ? <p className="text-sm font-medium text-sale" id="suggestion-root-category-error">{state.errors.root_category_id[0]}</p> : null}
          </div>
          {state.message ? <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${state.status === "success" ? "bg-accent/45 text-brand-hover" : "bg-sale/10 text-sale"}`} role="status">{state.message}</p> : null}
          <SubmitButton />
        </form>
      ) : null}
    </section>
  );
}
