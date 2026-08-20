"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ShoppingBag } from "lucide-react";

import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-hover disabled:opacity-60" disabled={pending} type="submit"><ShoppingBag aria-hidden="true" className="size-5" />{pending ? "Agregando…" : "Solicitar compra"}</button>;
}

export function AddToCartForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, initialActionState);
  return <form action={formAction} className="mt-7 flex flex-wrap items-end gap-3"><label className="space-y-1 text-sm font-semibold text-ink">Cantidad<input className="block w-24 rounded-xl border border-line bg-surface px-3 py-2" defaultValue="1" max="99" min="1" name="quantity" type="number" /></label><SubmitButton />{state.message ? <p className="w-full text-sm font-medium text-sale" role="status">{state.message}</p> : null}</form>;
}
