"use client";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

export function DisputeResolutionForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useFormAction(action);
  return <form action={formAction} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Resolución<select className="mt-2 min-h-12 w-full rounded-2xl border border-line px-4" defaultValue={state.values?.resolution} key={`resolution-${state.values?.resolution ?? ""}`} name="resolution" required><option value="buyer_favor">A favor de comprador</option><option value="seller_favor">A favor de vendedor</option><option value="dismissed">Desestimada</option></select></label><fieldset><legend className="text-sm font-semibold">¿Responsabilidad de vendedor?</legend><div className="mt-2 flex gap-4"><label><input defaultChecked={state.values?.seller_fault === "true"} name="seller_fault" required type="radio" value="true" /> Sí</label><label><input defaultChecked={state.values?.seller_fault === "false"} name="seller_fault" required type="radio" value="false" /> No</label></div></fieldset><label className="block text-sm font-semibold">Notas de resolución<textarea className="mt-2 min-h-28 w-full rounded-2xl border border-line p-4" maxLength={3000} defaultValue={state.values?.notes} minLength={10} name="notes" required /></label><button className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white" disabled={pending} type="submit">{pending ? "Resolviendo…" : "Resolver disputa"}</button>{state.message ? <p className={state.status === "error" ? "text-sale" : "text-success"} role="status">{state.message}</p> : null}</form>;
}
