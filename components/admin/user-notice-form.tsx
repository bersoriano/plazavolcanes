"use client";

import { useState } from "react";

import { NoticeActionMessage, NoticeFields } from "@/components/admin/notice-fields";
import type { ActionState } from "@/lib/action-state";
import { sendNotice } from "@/lib/actions/platform-notices";
import type { AdminMarketplaceUser } from "@/lib/queries/admin";
import { useFormAction } from "@/lib/use-form-action";

/**
 * Writes to one person from their card. Unlike the account controls it is
 * offered on administrator accounts too: writing to a colleague takes nothing
 * from them.
 */
export function UserNoticeForm({ user }: { user: AdminMarketplaceUser }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useFormAction(
    async (previous: ActionState, formData: FormData) => {
      const result = await sendNotice(previous, formData);
      // Sent: the form has done its work. Refused: it stays, with what was typed.
      if (result.status === "success") setOpen(false);

      return result;
    },
  );
  const labelName = user.displayName ?? user.email ?? "cuenta sin nombre";

  if (!open) {
    return (
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          className="min-h-11 rounded-full border border-line bg-surface px-5 text-sm font-semibold"
          onClick={() => setOpen(true)}
          type="button"
        >
          Enviar aviso <span className="sr-only">a {labelName}</span>
        </button>
        <NoticeActionMessage state={state} />
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-5 space-y-4 rounded-2xl border border-line bg-background p-4"
    >
      <input name="audience" type="hidden" value="person" />
      <input name="recipient_id" type="hidden" value={user.id} />
      <p className="text-sm font-semibold">
        Aviso para {labelName}{" "}
        <span className="font-normal text-muted">Llegará a su bandeja como Plaza Volcanes.</span>
      </p>

      <NoticeFields idPrefix={`notice-${user.id}`} values={state.values} />

      <div className="flex flex-wrap gap-3">
        <button
          className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Enviando…" : "Enviar aviso"}
        </button>
        <button
          className="min-h-11 rounded-full border border-line px-5 text-sm font-semibold"
          disabled={pending}
          onClick={() => setOpen(false)}
          type="button"
        >
          Cancelar
        </button>
      </div>
      <NoticeActionMessage state={state} />
    </form>
  );
}
