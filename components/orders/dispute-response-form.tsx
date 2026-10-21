"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

export function DisputeResponseForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useFormAction(action);
  return <form action={formAction} className="mt-4 space-y-3"><label className="block text-sm font-semibold">Tu respuesta<Textarea className="mt-2 p-4" maxLength={3000} defaultValue={state.values?.response} minLength={10} name="response" required /></label><Button className="bg-brand px-5 py-3 text-sm text-white" disabled={pending} type="submit">{pending ? "Enviando…" : "Responder disputa"}</Button>{state.message ? <p className={state.status === "error" ? "text-sale" : "text-success"} role="status">{state.message}</p> : null}</form>;
}
