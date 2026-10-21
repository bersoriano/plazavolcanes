"use client";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";
import type { OrderStatus } from "@/lib/database.types";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

function ActionForm({ action, label, danger = false, tracking = false, cancellationReasons = false }: { action: Action; label: string; danger?: boolean; tracking?: boolean; cancellationReasons?: boolean }) {
  const [state, formAction, pending] = useFormAction(action);
  return <form action={formAction} className="space-y-3"><input name="idempotency_key" type="hidden" value={crypto.randomUUID()} />{tracking ? <label className="block text-sm font-semibold">Seguimiento o referencia<Input className="mt-2" defaultValue={state.values?.tracking_text} maxLength={500} name="tracking_text" /></label> : null}{cancellationReasons ? <label className="block text-sm font-semibold">Razón de cancelación<Select className="mt-2" defaultValue={state.values?.reason ?? ""} key={`reason-${state.values?.reason ?? ""}`} name="reason" required><option disabled value="">Selecciona una razón</option><option value="buyer_non_payment">Falta de pago del comprador</option><option value="inventory_unavailable">Inventario no disponible</option><option value="seller_unavailable">No puedo completar el pedido</option><option value="other">Otra razón</option></Select></label> : null}<Button variant="unstyled" className={`rounded-full px-5 py-3 text-sm font-semibold ${danger ? "bg-sale text-white" : "bg-brand text-white"}`} disabled={pending} type="submit">{pending ? "Actualizando…" : label}</Button>{state.message ? <p className={`text-sm ${state.status === "error" ? "text-sale" : "text-success"}`} role="status">{state.message}</p> : null}</form>;
}

/**
 * Rejecting cannot be undone and the buyer sees it, so the first tap only
 * asks; the request is sent from inside the confirmation.
 */
function RejectConfirmation({ action }: { action: Action }) {
  return <details className="group/reject"><summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full bg-sale px-5 py-3 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">Rechazar</summary><div className="mt-3 max-w-sm rounded-2xl bg-sale/10 p-4"><p className="mb-3 text-sm leading-6 text-ink">¿Rechazar esta solicitud? El comprador verá que la rechazaste y las unidades vuelven a tu catálogo.</p><ActionForm action={action} danger label="Sí, rechazar" /></div></details>;
}

/**
 * The moves each side has on an order. Forms are keyed by what they do, so a
 * finished step never hands its message to the next one rendered in its place.
 * A collected order is marked as handed over, with no tracking to ask for.
 */
export function OrderActions({ role, status, actions, paymentConfirmationRequired = false, paymentCompletedAt = null, fulfillmentMethod = "shipping" }: { role: "buyer" | "seller"; status: OrderStatus; actions: Partial<Record<"accept" | "reject" | "ship" | "receive" | "complete" | "payment" | "cancelBuyer" | "cancelSeller", Action>>; paymentConfirmationRequired?: boolean; paymentCompletedAt?: string | null; fulfillmentMethod?: "pickup" | "shipping" }) {
  if (role === "seller" && status === "requested") return <div className="flex flex-wrap items-start gap-4"><ActionForm action={actions.accept!} key="accept" label="Aceptar pedido" /><RejectConfirmation action={actions.reject!} key="reject" /></div>;
  if (role === "seller" && status === "accepted") return <div className="grid gap-5 sm:grid-cols-2">{paymentConfirmationRequired && !paymentCompletedAt ? <ActionForm action={actions.payment!} key="payment" label="Confirmar pago" /> : fulfillmentMethod === "pickup" ? <ActionForm action={actions.ship!} key="hand-over" label="Marcar como entregado" /> : <ActionForm action={actions.ship!} key="ship" label="Marcar como enviado" tracking />}{!paymentCompletedAt && actions.cancelSeller ? <ActionForm action={actions.cancelSeller} cancellationReasons danger key="cancel" label="Cancelar pedido" /> : null}</div>;
  if (role === "buyer" && (status === "requested" || (status === "accepted" && !paymentCompletedAt))) return actions.cancelBuyer ? <ActionForm action={actions.cancelBuyer} danger label="Cancelar pedido" /> : null;
  if (role === "buyer" && status === "shipped") return <ActionForm action={actions.receive!} label="Confirmar recepción" />;
  if (role === "buyer" && status === "delivered") return <ActionForm action={actions.complete!} label="Confirmar satisfacción" />;
  return null;
}
