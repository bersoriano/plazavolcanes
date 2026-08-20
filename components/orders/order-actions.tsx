"use client";

import { useActionState } from "react";

import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";
import type { OrderStatus } from "@/lib/database.types";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

function ActionForm({ action, label, danger = false, tracking = false }: { action: Action; label: string; danger?: boolean; tracking?: boolean }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return <form action={formAction} className="space-y-3"><input name="idempotency_key" type="hidden" value={crypto.randomUUID()} />{tracking ? <label className="block text-sm font-semibold">Seguimiento o referencia<input className="mt-2 min-h-12 w-full rounded-2xl border border-line px-4" maxLength={500} name="tracking_text" /></label> : null}<button className={`rounded-full px-5 py-3 text-sm font-semibold ${danger ? "bg-sale text-white" : "bg-brand text-white"}`} disabled={pending} type="submit">{pending ? "Actualizando…" : label}</button>{state.message ? <p className={`text-sm ${state.status === "error" ? "text-sale" : "text-success"}`} role="status">{state.message}</p> : null}</form>;
}

export function OrderActions({ role, status, actions }: { role: "buyer" | "seller"; status: OrderStatus; actions: Partial<Record<"accept" | "reject" | "ship" | "receive" | "complete", Action>> }) {
  if (role === "seller" && status === "requested") return <div className="flex flex-wrap gap-4"><ActionForm action={actions.accept!} label="Aceptar pedido" /><ActionForm action={actions.reject!} danger label="Rechazar" /></div>;
  if (role === "seller" && status === "accepted") return <ActionForm action={actions.ship!} label="Marcar como enviado" tracking />;
  if (role === "buyer" && status === "shipped") return <ActionForm action={actions.receive!} label="Confirmar recepción" />;
  if (role === "buyer" && status === "delivered") return <ActionForm action={actions.complete!} label="Confirmar satisfacción" />;
  return null;
}
