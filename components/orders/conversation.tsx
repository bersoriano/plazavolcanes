"use client";

import { useActionState } from "react";

import type { ActionState } from "@/lib/action-state";
import { initialActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";

type Message = { id: number; sender_id: string; body: string; created_at: string };

export function Conversation({ action, currentUserId, messages }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; currentUserId: string; messages: Message[] }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return <section className="rounded-[2rem] border border-line bg-surface p-6"><h2 className="font-display text-2xl font-semibold">Conversación</h2><div className="mt-5 space-y-3">{messages.length ? messages.map((message) => <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.sender_id === currentUserId ? "ml-auto bg-brand text-white" : "bg-background text-ink"}`} key={message.id}><p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p><p className="mt-1 text-xs opacity-70">{formatDate(message.created_at)}</p></div>) : <p className="text-sm text-muted">Aún no hay mensajes.</p>}</div><form action={formAction} className="mt-5 space-y-3"><input name="idempotency_key" type="hidden" value={crypto.randomUUID()} /><label className="sr-only" htmlFor="order-message">Mensaje</label><textarea className="min-h-28 w-full rounded-2xl border border-line bg-background p-4" id="order-message" maxLength={2000} name="body" placeholder="Escribe un mensaje" required /><button className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white" disabled={pending} type="submit">{pending ? "Enviando…" : "Enviar mensaje"}</button>{state.message ? <p className={`text-sm ${state.status === "error" ? "text-sale" : "text-success"}`} role="status">{state.message}</p> : null}</form></section>;
}
