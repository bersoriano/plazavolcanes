"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import type { ThreadMessage } from "@/lib/queries/messages";
import { useFormAction } from "@/lib/use-form-action";
import { useLiveThread } from "@/components/messages/use-live-thread";

function SendButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Enviando…" : "Enviar mensaje"}
    </Button>
  );
}

export function MessageThread({
  action,
  conversationId,
  currentUserId,
  messages,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  conversationId: number;
  currentUserId: string;
  messages: ThreadMessage[];
}) {
  const [state, formAction] = useFormAction(action);
  const { shown } = useLiveThread({ conversationId, currentUserId, messages });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shown.length) return;

    // Absent in jsdom, and in any environment without a layout engine.
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [shown]);

  return (
    <Card padding="md" as="section" >
      <h2 className="font-display text-2xl font-semibold">Conversación</h2>

      <div className="mt-5 space-y-3">
        {shown.length ? (
          shown.map((message) => (
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.sender_id === currentUserId
                  ? "ml-auto bg-brand text-white"
                  : "bg-background text-ink"
              }`}
              key={message.id}
            >
              <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
              <p className="mt-1 text-xs opacity-70">{formatDate(message.created_at)}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">Aún no hay mensajes.</p>
        )}
        <div ref={endRef} />
      </div>

      <form action={formAction} className="mt-5 space-y-3">
        <label className="sr-only" htmlFor="message-body">
          Mensaje
        </label>
        <Textarea
          className="bg-background p-4"
          defaultValue={state.values?.body}
          id="message-body"
          maxLength={2000}
          name="body"
          placeholder="Escribe un mensaje"
          required
        />
        <SendButton />
        {state.message ? (
          <p
            className={`text-sm ${state.status === "error" ? "text-sale" : "text-success"}`}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
