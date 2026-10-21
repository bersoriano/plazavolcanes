"use client";

import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

export function DisputeForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useFormAction(action);
  return <details className="rounded-[2rem] border border-line bg-surface p-6"><summary className="cursor-pointer font-display text-xl font-semibold text-sale">Reportar un problema</summary><form action={formAction} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Motivo<Select className="mt-2" defaultValue={state.values?.reason} key={`reason-${state.values?.reason ?? ""}`} name="reason" required><option value="item_not_received">No recibí el producto</option><option value="item_not_as_described">No coincide con descripción</option><option value="damaged_item">Llegó dañado</option><option value="other">Otro</option></Select></label><label className="block text-sm font-semibold">Explica lo sucedido<Textarea className="mt-2 min-h-32 p-4" maxLength={3000} defaultValue={state.values?.statement} minLength={10} name="statement" required /></label><Button variant="danger" className="px-5 py-3 text-sm" disabled={pending} type="submit">{pending ? "Enviando…" : "Abrir disputa"}</Button>{state.message ? <p className={state.status === "error" ? "text-sale" : "text-success"} role="status">{state.message}</p> : null}</form></details>;
}
