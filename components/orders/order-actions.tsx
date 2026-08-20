"use client";

import { useActionState } from "react";

import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";
import type { OrderStatus } from "@/lib/database.types";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

function ActionForm({ action, label, danger = false, tracking = false, cancellationReasons = false }: { action: Action; label: string; danger?: boolean; tracking?: boolean; cancellationReasons?: boolean }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return <form action={formAction} className="space-y-3"><input name="idempotency_key" type="hidden" value={crypto.randomUUID()} />{tracking ? <label className="block text-sm font-semibold">Seguimiento o referencia<input className="mt-2 min-h-12 w-full rounded-2xl border border-line px-4" maxLength={500} name="tracking_text" /></label> : null}{cancellationReasons ? <label className="block text-sm font-semibold">Razón de cancelación<select className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-surface px-4" defaultValue="" name="reason" required><option disabled value="">Selecciona una razón</option><option value="buyer_non_payment">Falta de pago del comprador</option><option value="inventory_unavailable">Inventario no disponible</option><option value="seller_unavailable">No puedo completar el pedido</option><option value="other">Otra razón</option></select></label> : null}<button className={`rounded-full px-5 py-3 text-sm font-semibold ${danger ? "bg-sale text-white" : "bg-brand text-white"}`} disabled={pending} type="submit">{pending ? "Actualizando…" : label}</button>{state.message ? <p className={`text-sm ${state.status === "error" ? "text-sale" : "text-success"}`} role="status">{state.message}</p> : null}</form>;
}

export function OrderActions({ role, status, actions, paymentConfirmationRequired = false, paymentCompletedAt = null }: { role: "buyer" | "seller"; status: OrderStatus; actions: Partial<Record<"accept" | "reject" | "ship" | "receive" | "complete" | "payment" | "cancelBuyer" | "cancelSeller", Action>>; paymentConfirmationRequired?: boolean; paymentCompletedAt?: string | null }) {
  if (role === "seller" && status === "requested") return <div className="flex flex-wrap gap-4"><ActionForm action={actions.accept!} label="Aceptar pedido" /><ActionForm action={actions.reject!} danger label="Rechazar" /></div>;
  if (role === "seller" && status === "accepted") return <div className="grid gap-5 sm:grid-cols-2">{paymentConfirmationRequired && !paymentCompletedAt ? <ActionForm action={actions.payment!} label="Confirmar pago" /> : <ActionForm action={actions.ship!} label="Marcar como enviado" tracking />}{!paymentCompletedAt && actions.cancelSeller ? <ActionForm action={actions.cancelSeller} cancellationReasons danger label="Cancelar pedido" /> : null}</div>;
  if (role === "buyer" && (status === "requested" || (status === "accepted" && !paymentCompletedAt))) return actions.cancelBuyer ? <ActionForm action={actions.cancelBuyer} danger label="Cancelar pedido" /> : null;
  if (role === "buyer" && status === "shipped") return <ActionForm action={actions.receive!} label="Confirmar recepción" />;
  if (role === "buyer" && status === "delivered") return <ActionForm action={actions.complete!} label="Confirmar satisfacción" />;
  return null;
}
