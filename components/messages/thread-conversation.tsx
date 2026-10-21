"use client";

import { Fragment, useEffect, useRef } from "react";
import { SendHorizontal } from "lucide-react";

import { STICK_ABOVE_BAR } from "@/components/messages/inbox-layout";
import { useLiveThread } from "@/components/messages/use-live-thread";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { formatMessageDay, formatMessageTime, sameCalendarDay } from "@/lib/format";
import type { ThreadMessage } from "@/lib/queries/messages";
import { useFormAction } from "@/lib/use-form-action";
import { useViewerTimeZone } from "@/lib/use-viewer-time-zone";

/**
 * The open conversation in the inbox: the messages, and the box to answer in.
 *
 * From `lg` the messages scroll inside the frame and the box stays at its foot.
 * On a phone the page itself scrolls and the box sticks above the quick access
 * bar, so nothing here depends on knowing how tall the window is.
 */
export function ThreadConversation({
  action,
  conversationId,
  currentUserId,
  messages,
  now,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  conversationId: number;
  currentUserId: string;
  messages: ThreadMessage[];
  /** When the server rendered, so "Hoy" and "Ayer" are decided once. */
  now: string;
}) {
  const [state, formAction, pending] = useFormAction(action);
  const { latestId, shown } = useLiveThread({
    conversationId,
    currentUserId,
    messages,
    refreshOnRead: true,
  });
  const timeZone = useViewerTimeZone();
  const logRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // Keyed on the newest message, so a refresh that brings nothing new leaves
  // somebody reading further up where they are.
  useEffect(() => {
    const log = logRef.current;
    if (latestId === null || !log) return;

    // Inside the frame the log is its own scroller, and only it may move:
    // bringing the message into view through the page would drag the frame
    // under the site header.
    if (getComputedStyle(log).overflowY === "auto") {
      log.scrollTop = log.scrollHeight;
      return;
    }

    // On a phone the page is the scroller. Absent in jsdom.
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [latestId]);

  // Sending moves focus to the button; a conversation goes on in the box.
  useEffect(() => {
    if (state.status === "success") boxRef.current?.focus();
  }, [state]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        aria-label="Conversación"
        className="flex-1 space-y-3 px-4 py-5 sm:px-6 lg:overflow-y-auto lg:overscroll-contain"
        ref={logRef}
        role="log"
      >
        {shown.length ? (
          shown.map((message, index) => {
            const mine = message.sender_id === currentUserId;
            const previous = shown[index - 1];
            const startsDay =
              !previous || !sameCalendarDay(previous.created_at, message.created_at, timeZone);

            return (
              <Fragment key={message.id}>
                {startsDay ? (
                  <p className="py-2 text-center text-xs font-semibold text-muted">
                    {formatMessageDay(message.created_at, now, timeZone)}
                  </p>
                ) : null}
                <div
                  className={`w-fit max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    mine ? "ml-auto bg-brand text-white" : "border border-line bg-background text-ink"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                  <p className="mt-0.5 text-right text-xs opacity-70">
                    <time dateTime={message.created_at}>
                      {formatMessageTime(message.created_at, timeZone)}
                    </time>
                  </p>
                </div>
              </Fragment>
            );
          })
        ) : (
          <p className="py-10 text-center text-sm text-muted">
            Aún no hay mensajes. Escribe el primero.
          </p>
        )}
        {/* The margin is the room the sticky box and the bar take on a phone. */}
        <div className="scroll-mb-40" ref={endRef} />
      </div>

      <form
        action={formAction}
        className={`${STICK_ABOVE_BAR} shrink-0 border-t border-line bg-surface px-4 py-3 sm:px-6`}
      >
        {state.status === "error" && state.message ? (
          <p className="mb-2 text-sm text-sale" role="status">
            {state.message}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="message-body">
            Mensaje
          </label>
          {/* 16px text: anything smaller makes a phone zoom in on focus. */}
          <Textarea
            variant="unstyled"
            className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-3xl border border-line bg-background px-4 py-2.5 leading-6 text-ink focus:border-brand focus:outline-none"
            defaultValue={state.values?.body}
            id="message-body"
            maxLength={2000}
            name="body"
            placeholder="Escribe un mensaje"
            ref={boxRef}
            required
            rows={1}
          />
          <Button
            variant="unstyled"
            aria-label="Enviar mensaje"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-hover disabled:opacity-55"
            disabled={pending}
            type="submit"
          >
            <SendHorizontal aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
