"use client";

import { setProductUnits } from "@/lib/actions/catalog";
import { MAX_UNITS } from "@/lib/listing-readiness";
import { useFormAction } from "@/lib/use-form-action";

/** Stock edited where the seller sees it, without opening the whole listing. */
export function ProductUnitsForm({
  productId,
  productName,
  units,
}: {
  productId: number;
  productName: string;
  units: number | null;
}) {
  const action = setProductUnits.bind(null, productId);
  const [state, formAction, pending] = useFormAction(action);
  const fieldId = `units-${productId}`;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={fieldId}>
        Unidades de {productName}
      </label>
      <input
        className="h-11 w-20 rounded-xl border border-line bg-surface px-3 text-sm tabular-nums text-ink focus:border-brand focus:outline-none"
        defaultValue={state.values?.units_available ?? units ?? undefined}
        id={fieldId}
        inputMode="numeric"
        max={MAX_UNITS}
        min={0}
        name="units_available"
        step={1}
        type="number"
      />
      <span aria-hidden="true" className="text-xs text-muted">unidades</span>
      <button
        aria-label={`Guardar unidades de ${productName}`}
        className="inline-flex min-h-11 items-center text-xs font-semibold text-brand disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
      {state.message ? (
        <p className={`w-full text-xs ${state.status === "error" ? "text-sale" : "text-success"}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
