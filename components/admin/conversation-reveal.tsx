"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminReadState } from "@/lib/actions/admin-conversation";
import { formatDate } from "@/lib/format";

function OpenButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      className="bg-brand px-5 py-3 text-sm text-white"
      disabled={pending}
      type="submit"
    >
      {pending ? "Abriendo…" : "Abrir conversación"}
    </Button>
  );
}

export function ConversationReveal({
  action,
  conversationId,
}: {
  action: (state: AdminReadState, formData: FormData) => Promise<AdminReadState>;
  conversationId: number;
}) {
  const [state, formAction] = useActionState(action, { status: "idle", message: "" });
  const reasonId = `reason-${conversationId}`;

  return (
    <div className="mt-5 rounded-2xl border border-line bg-background p-5">
      <form action={formAction} className="space-y-3">
        <label className="block text-sm font-semibold" htmlFor={reasonId}>
          Motivo de la consulta
        </label>
        <p className="text-sm text-muted">
          Abrir esta conversación queda registrado con tu nombre y el motivo que escribas.
        </p>
        <Input
          className="py-3"
          defaultValue={state.values?.reason}
          id={reasonId}
          maxLength={500}
          minLength={3}
          name="reason"
          required
          type="text"
        />
        <OpenButton />
      </form>

      {state.messages?.length ? (
        <ul className="mt-5 space-y-3">
          {state.messages.map((message) => (
            <li className="rounded-2xl bg-surface p-4" key={message.id}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                {message.sender_label} · {formatDate(message.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {state.status === "error" ? (
        <p className="mt-3 text-sm text-sale" role="status">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
