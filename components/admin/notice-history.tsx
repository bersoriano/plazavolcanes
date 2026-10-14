"use client";

import { useState } from "react";

import { AUDIENCE_LABELS } from "@/components/admin/broadcast-form";
import { NoticeActionMessage } from "@/components/admin/notice-fields";
import { retractNotice } from "@/lib/actions/platform-notices";
import { formatDate } from "@/lib/format";
import type { NoticeBatch } from "@/lib/queries/platform-notices";
import { useFormAction } from "@/lib/use-form-action";

/** Who it went to, and what became of it. */
function summary(batch: NoticeBatch) {
  const to =
    batch.audience === "person"
      ? (batch.recipientLabel ?? "Cuenta eliminada")
      : AUDIENCE_LABELS[batch.audience];

  if (batch.retractedAt) return `${to} · Retirado el ${formatDate(batch.retractedAt)}`;
  if (batch.audience === "person") return `${to} · ${batch.readCount > 0 ? "Leído" : "Sin leer"}`;

  const sent = `${batch.recipientCount} ${batch.recipientCount === 1 ? "enviado" : "enviados"}`;
  const read = `${batch.readCount} ${batch.readCount === 1 ? "leído" : "leídos"}`;

  return `${to} · ${sent} · ${read}`;
}

/**
 * Takes a send back. It leaves every inbox it reached and cannot be put back,
 * so it asks first, in place and without a browser dialog.
 */
function Retract({ batch }: { batch: NoticeBatch }) {
  const [state, formAction, pending] = useFormAction(retractNotice);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="min-h-11 rounded-full border border-sale/40 bg-surface px-5 text-sm font-semibold text-sale"
          onClick={() => setConfirming(true)}
          type="button"
        >
          Retirar <span className="sr-only">{batch.title}</span>
        </button>
        <NoticeActionMessage state={state} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-sale/40 bg-surface p-4">
      <input name="batch_id" type="hidden" value={batch.id} />
      <p className="text-sm leading-6 text-muted">
        Se quitará de todas las bandejas donde llegó. No se puede volver a poner.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          className="min-h-11 rounded-full bg-sale px-5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Retirando…" : "Retirar definitivamente"}
        </button>
        <button
          className="min-h-11 rounded-full border border-line px-5 text-sm font-semibold"
          disabled={pending}
          onClick={() => setConfirming(false)}
          type="button"
        >
          Cancelar
        </button>
      </div>
      <NoticeActionMessage state={state} />
    </form>
  );
}

/** Everything administration has sent, newest first. */
export function NoticeHistory({ batches }: { batches: NoticeBatch[] }) {
  if (!batches.length) {
    return (
      <p className="rounded-[2rem] border border-dashed border-line bg-surface/60 px-6 py-8 text-sm leading-6 text-muted">
        Aún no se ha enviado nada.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[2rem] border border-line bg-surface">
      {batches.map((batch) => (
        <li className="space-y-3 p-5 sm:p-6" key={batch.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="min-w-0 font-semibold">{batch.title}</h3>
            <time className="shrink-0 text-sm text-muted" dateTime={batch.createdAt}>
              {formatDate(batch.createdAt)}
            </time>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            {summary(batch)}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted">{batch.body}</p>
          {batch.action ? (
            <p className="break-words text-sm text-muted">
              {batch.action.label} → {batch.action.href}
            </p>
          ) : null}
          {/* Keyed by its state, so a send that was just retracted drops the form with it. */}
          {batch.retractedAt ? null : <Retract batch={batch} key={batch.id} />}
        </li>
      ))}
    </ul>
  );
}
