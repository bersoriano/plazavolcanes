"use client";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

export function ReviewForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useFormAction(action);
  return <form action={formAction} className="space-y-4 rounded-[2rem] border border-line bg-surface p-6"><h2 className="font-display text-2xl font-semibold">Califica tu compra</h2><label className="block text-sm font-semibold">Calificación<Select className="mt-2" defaultValue={state.values?.rating} key={`rating-${state.values?.rating ?? ""}`} name="rating" required><option value="">Selecciona</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} estrellas</option>)}</Select></label><fieldset><legend className="text-sm font-semibold">¿Coincidió con la descripción?</legend><div className="mt-2 flex gap-4"><label><Input defaultChecked={state.values?.matched_description === "true"} name="matched_description" required type="radio" value="true" /> Sí</label><label><Input defaultChecked={state.values?.matched_description === "false"} name="matched_description" required type="radio" value="false" /> No</label></div></fieldset><label className="block text-sm font-semibold">Comentario opcional<Textarea className="mt-2 min-h-24 p-4" defaultValue={state.values?.comment} maxLength={2000} name="comment" /></label><Button className="bg-brand px-5 py-3 text-sm text-white" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar reseña"}</Button>{state.message ? <p className={state.status === "error" ? "text-sale" : "text-success"} role="status">{state.message}</p> : null}</form>;
}
