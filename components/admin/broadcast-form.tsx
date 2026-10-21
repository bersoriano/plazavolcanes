"use client";

import { useRef, useState } from "react";

import { NoticeActionMessage, NoticeFields } from "@/components/admin/notice-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { sendNotice } from "@/lib/actions/platform-notices";
import type { AudienceCounts } from "@/lib/queries/platform-notices";
import { useFormAction } from "@/lib/use-form-action";
import type { BroadcastAudience } from "@/lib/validation/platform-notice";

export const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  everyone: "Todas las personas",
  sellers: "Quienes venden",
  buyers: "Quienes solo compran",
};

const AUDIENCES = Object.keys(AUDIENCE_LABELS) as BroadcastAudience[];

export function people(count: number) {
  return `${count} ${count === 1 ? "persona" : "personas"}`;
}

/**
 * Writes to an audience. An announcement cannot be edited once it is out, so
 * the first press never sends: it says how many people it will reach, and the
 * second one sends.
 */
export function BroadcastForm({ counts }: { counts: AudienceCounts }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [audience, setAudience] = useState<BroadcastAudience>("everyone");
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useFormAction(
    async (previous: ActionState, formData: FormData) => {
      const result = await sendNotice(previous, formData);
      setConfirming(false);

      return result;
    },
  );
  const reach = people(counts[audience]);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-[2rem] border border-line bg-surface p-6 sm:p-8"
      ref={formRef}
    >
      <h2 className="font-display text-2xl font-semibold">Nuevo anuncio</h2>

      <fieldset>
        <legend className="text-sm font-semibold">Para</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {AUDIENCES.map((option) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-background px-3 py-2 text-sm font-semibold has-checked:border-brand"
              key={option}
            >
              <Input
                variant="unstyled"
                checked={audience === option}
                className="size-4 accent-brand"
                name="audience"
                onChange={() => setAudience(option)}
                type="radio"
                value={option}
              />
              <span className="min-w-0 flex-1">{AUDIENCE_LABELS[option]}</span>
              <span className="text-muted">{counts[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <NoticeFields idPrefix="broadcast" values={state.values} />

      {confirming ? (
        <div className="space-y-3 rounded-2xl border border-brand/30 bg-background p-4">
          <p className="text-sm leading-6">
            <strong>Se enviará a {reach}.</strong> No se puede editar después; solo retirar.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              className="min-h-11 bg-brand px-5 text-sm text-white disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Enviando…" : `Enviar a ${reach}`}
            </Button>
            <Button
              variant="unstyled"
              className="min-h-11 rounded-full border border-line px-5 text-sm font-semibold"
              disabled={pending}
              onClick={() => setConfirming(false)}
              type="button"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="min-h-11 bg-brand px-5 text-sm text-white"
          // The browser checks the required fields first, so the confirmation
          // is never about an announcement with nothing in it.
          onClick={() => {
            if (formRef.current?.reportValidity()) setConfirming(true);
          }}
          type="button"
        >
          Enviar anuncio
        </Button>
      )}

      <NoticeActionMessage state={state} />
    </form>
  );
}
