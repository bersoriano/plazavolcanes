"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/action-state";
import { markConversationRead } from "@/lib/actions/messages";
import { formatDate } from "@/lib/format";
import type { ThreadMessage } from "@/lib/queries/messages";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormAction } from "@/lib/use-form-action";
import { Button } from "@/components/ui/button";

/** How often a thread with a broken socket falls back to asking the server. */
const DEGRADED_POLL_MS = 20_000;

/**
 * A subscription reports SUBSCRIBED before the server has finished registering
 * it, so there is a window where the socket is silently not yet live. It is
 * short against a warm Realtime and several seconds against one that just
 * started, which is exactly when everyone reconnects at once. For that window
 * the thread also asks the server, so a message sent into the gap still lands.
 */
const CATCH_UP_MS = 4_000;
const CATCH_UP_WINDOW_MS = 30_000;

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
  const [live, setLive] = useState<ThreadMessage[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [catchingUp, setCatchingUp] = useState(false);
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);

  // The server render is the truth. Anything the socket delivers is merged on
  // top of it, and a message already rendered is dropped rather than doubled.
  const shown = useMemo(() => {
    const byId = new Map(messages.map((message) => [message.id, message]));
    for (const message of live) byId.set(message.id, message);

    return [...byId.values()].sort((left, right) => left.id - right.id);
  }, [messages, live]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      // Realtime authorizes each subscriber against the row-level policy, and
      // that policy grants the authenticated role. The socket opens with only
      // the publishable key, so without handing it the session it subscribes as
      // anon and is delivered nothing at all.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      supabase.realtime.setAuth(data.session?.access_token ?? null);
      channel = supabase
        .channel(`conversation-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload: { new: ThreadMessage }) => setLive((current) => [...current, payload.new]),
        )
        .subscribe((status: string) => {
          // A dropped socket falls back to refreshing, which is how this thread
          // behaved before live delivery existed. It must never read as empty.
          setDegraded(status === "CHANNEL_ERROR" || status === "TIMED_OUT");
          if (status === "SUBSCRIBED") setCatchingUp(true);
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!degraded) return;

    const refresh = () => router.refresh();
    const timer = setInterval(refresh, DEGRADED_POLL_MS);
    window.addEventListener("focus", refresh);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [degraded, router]);

  useEffect(() => {
    if (!catchingUp) return;

    const timer = setInterval(() => router.refresh(), CATCH_UP_MS);
    const stop = setTimeout(() => setCatchingUp(false), CATCH_UP_WINDOW_MS);

    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [catchingUp, router]);

  useEffect(() => {
    const latest = shown.at(-1);
    if (!latest) return;

    // Absent in jsdom, and in any environment without a layout engine.
    endRef.current?.scrollIntoView?.({ block: "end" });
    void markConversationRead(conversationId, latest.id);
  }, [conversationId, shown]);

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6">
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
        <textarea
          className="min-h-28 w-full rounded-2xl border border-line bg-background p-4"
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
    </section>
  );
}
