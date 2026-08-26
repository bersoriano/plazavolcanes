"use client";

import { useFormStatus } from "react-dom";
import { ShoppingBag } from "lucide-react";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-hover disabled:opacity-60" disabled={pending} type="submit"><ShoppingBag aria-hidden="true" className="size-5" />{pending ? "Agregando…" : "Solicitar compra"}</button>;
}

export function AddToCartForm({
  action,
  productPath,
  unitsAvailable,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Where to send a signed-out buyer back to if the purchase cannot proceed. */
  productPath: string;
  unitsAvailable: number;
}) {
  const [state, formAction] = useFormAction(action);
  const remaining = unitsAvailable === 1 ? "Queda 1 unidad" : `Quedan ${unitsAvailable} unidades`;

  return <form action={formAction} className="mt-7 flex flex-wrap items-end gap-3"><input name="producto" type="hidden" value={productPath} /><label className="space-y-1 text-sm font-semibold text-ink">Cantidad<input className="block w-24 rounded-xl border border-line bg-surface px-3 py-2" defaultValue={state.values?.quantity ?? "1"} max={unitsAvailable} min="1" name="quantity" type="number" /></label><SubmitButton /><p className="text-sm font-medium text-muted">{remaining}</p>{state.message ? <p className="w-full text-sm font-medium text-sale" role="status">{state.message}</p> : null}</form>;
}
