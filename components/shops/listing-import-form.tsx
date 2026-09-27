"use client";

import type { ActionState } from "@/lib/action-state";
import { IMPORT_MAX_LINKS } from "@/lib/listing-import";
import { useFormAction } from "@/lib/use-form-action";

export function ListingImportForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useFormAction(action);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <label className="block text-sm font-semibold">
        Enlaces a tus publicaciones, uno por línea (hasta {IMPORT_MAX_LINKS})
        <textarea
          className="mt-2 min-h-28 w-full rounded-2xl border border-line bg-background p-4 font-normal"
          defaultValue={state.values?.links}
          key={`links-${state.status}-${state.message}`}
          name="links"
          placeholder={"https://articulo.mercadolibre.com.mx/…\nhttps://www.facebook.com/marketplace/item/…"}
          required
        />
      </label>
      <label className="block text-sm font-semibold">
        Nota (opcional)
        <input
          className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-background px-4 font-normal"
          defaultValue={state.values?.note}
          key={`note-${state.status}-${state.message}`}
          maxLength={500}
          name="note"
          placeholder="Por ejemplo: todos son usados, en buen estado."
        />
      </label>
      <button
        className="min-h-11 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Enviando…" : "Enviar enlaces"}
      </button>
      {state.message ? (
        <p className={`text-sm ${state.status === "error" ? "text-sale" : "text-success"}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
