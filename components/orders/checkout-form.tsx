"use client";

import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";
import { Field } from "@/components/ui/field";

function CheckoutButton() {
  const { pending } = useFormStatus();
  return <button className="w-full rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Creando pedido…" : "Confirmar solicitud"}</button>;
}

export function CheckoutForm({ action, idempotencyKey }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; idempotencyKey: string }) {
  const [state, formAction] = useFormAction(action);
  return <form action={formAction} className="space-y-4" noValidate><input name="idempotency_key" type="hidden" value={idempotencyKey} /><input name="country_code" type="hidden" value="MX" /><Field defaultValue={state.values?.recipient} error={state.errors?.recipient?.[0]} label="Nombre de quien recibe" name="recipient" required /><Field defaultValue={state.values?.address_line1} error={state.errors?.address_line1?.[0]} label="Calle y número" name="address_line1" required /><Field defaultValue={state.values?.address_line2} error={state.errors?.address_line2?.[0]} label="Interior o referencia" name="address_line2" /><div className="grid gap-4 sm:grid-cols-2"><Field defaultValue={state.values?.locality} error={state.errors?.locality?.[0]} label="Ciudad o localidad" name="locality" required /><Field defaultValue={state.values?.administrative_area} error={state.errors?.administrative_area?.[0]} label="Estado" name="administrative_area" required /></div><Field defaultValue={state.values?.postal_code} error={state.errors?.postal_code?.[0]} label="Código postal" name="postal_code" required /><Field defaultValue={state.values?.delivery_instructions} error={state.errors?.delivery_instructions?.[0]} label="Instrucciones de entrega" name="delivery_instructions" /><Field defaultValue={state.values?.buyer_note} error={state.errors?.buyer_note?.[0]} label="Nota para vendedor" name="buyer_note" />{state.message ? <p className="rounded-xl bg-sale/10 p-3 text-sm font-medium text-sale" role="status">{state.message}</p> : null}<CheckoutButton /></form>;
}
