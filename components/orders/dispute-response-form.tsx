"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";

export function DisputeResponseForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return <form action={formAction} className="mt-4 space-y-3"><label className="block text-sm font-semibold">Tu respuesta<textarea className="mt-2 min-h-28 w-full rounded-2xl border border-line p-4" maxLength={3000} minLength={10} name="response" required /></label><button className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white" disabled={pending} type="submit">{pending ? "Enviando…" : "Responder disputa"}</button>{state.message ? <p className={state.status === "error" ? "text-sale" : "text-success"} role="status">{state.message}</p> : null}</form>;
}
