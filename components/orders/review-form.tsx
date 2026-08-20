"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";

export function ReviewForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return <form action={formAction} className="space-y-4 rounded-[2rem] border border-line bg-surface p-6"><h2 className="font-display text-2xl font-semibold">Califica tu compra</h2><label className="block text-sm font-semibold">Calificación<select className="mt-2 min-h-12 w-full rounded-2xl border border-line px-4" name="rating" required><option value="">Selecciona</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} estrellas</option>)}</select></label><fieldset><legend className="text-sm font-semibold">¿Coincidió con la descripción?</legend><div className="mt-2 flex gap-4"><label><input name="matched_description" required type="radio" value="true" /> Sí</label><label><input name="matched_description" required type="radio" value="false" /> No</label></div></fieldset><label className="block text-sm font-semibold">Comentario opcional<textarea className="mt-2 min-h-24 w-full rounded-2xl border border-line p-4" maxLength={2000} name="comment" /></label><button className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar reseña"}</button>{state.message ? <p className={state.status === "error" ? "text-sale" : "text-success"} role="status">{state.message}</p> : null}</form>;
}
