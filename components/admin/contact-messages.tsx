"use client";

import { useId } from "react";

import { NoticeActionMessage } from "@/components/admin/notice-fields";
import { markContactMessageAttended } from "@/lib/actions/contact";
import { formatDate } from "@/lib/format";
import type { ContactMessage } from "@/lib/queries/contact";
import { useFormAction } from "@/lib/use-form-action";

function Attend({ message, label }: { message: ContactMessage; label: string }) {
  const [state, formAction, pending] = useFormAction(markContactMessageAttended);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input name="message_id" type="hidden" value={message.id} />
      <button
        className="min-h-11 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-brand disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Marcando…" : "Marcar como atendido"}{" "}
        <span className="sr-only">el mensaje de {label}</span>
      </button>
      <NoticeActionMessage state={state} />
    </form>
  );
}

function MessageCard({ message }: { message: ContactMessage }) {
  const headingId = useId();
  const label = message.name ?? "Sin nombre";

  return (
    <article aria-labelledby={headingId} className="space-y-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="min-w-0 font-semibold" id={headingId}>
          {label}
        </h3>
        <time className="shrink-0 text-sm text-muted" dateTime={message.createdAt}>
          {formatDate(message.createdAt)}
        </time>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a className="break-all font-semibold text-brand underline underline-offset-4" href={`mailto:${message.email}`}>
          {message.email}
        </a>
        {message.phone ? (
          <a className="font-semibold text-brand underline underline-offset-4" href={`tel:${message.phone}`}>
            {message.phone}
          </a>
        ) : null}
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          {message.hasAccount ? "Con cuenta" : "Sin cuenta"}
        </span>
      </p>
      <p className="whitespace-pre-wrap break-words leading-7 text-ink">{message.message}</p>
      {message.attendedAt ? (
        <p className="text-sm font-semibold text-success">Atendido el {formatDate(message.attendedAt)}</p>
      ) : (
        <Attend label={label} message={message} />
      )}
    </article>
  );
}

/** What has been written to the plaza: what still waits first, then newest first. */
export function ContactMessages({ messages }: { messages: ContactMessage[] }) {
  if (!messages.length) {
    return (
      <p className="rounded-[2rem] border border-dashed border-line bg-surface/60 px-6 py-8 text-sm leading-6 text-muted">
        Aún no llega ningún mensaje.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[2rem] border border-line bg-surface">
      {messages.map((message) => (
        <li key={message.id}>
          <MessageCard message={message} />
        </li>
      ))}
    </ul>
  );
}
