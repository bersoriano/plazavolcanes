"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";

export function DisputeForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return <details className="rounded-[2rem] border border-line bg-surface p-6"><summary className="cursor-pointer font-display text-xl font-semibold text-sale">Reportar un problema</summary><form action={formAction} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Motivo<select className="mt-2 min-h-12 w-full rounded-2xl border border-line px-4" name="reason" required><option value="item_not_received">No recibí el producto</option><option value="item_not_as_described">No coincide con descripción</option><option value="damaged_item">Llegó dañado</option><option value="other">Otro</option></select></label><label className="block text-sm font-semibold">Explica lo sucedido<textarea className="mt-2 min-h-32 w-full rounded-2xl border border-line p-4" maxLength={3000} minLength={10} name="statement" required /></label><button className="rounded-full bg-sale px-5 py-3 text-sm font-semibold text-white" disabled={pending} type="submit">{pending ? "Enviando…" : "Abrir disputa"}</button>{state.message ? <p className={state.status === "error" ? "text-sale" : "text-success"} role="status">{state.message}</p> : null}</form></details>;
}
