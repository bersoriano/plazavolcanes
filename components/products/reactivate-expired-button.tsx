"use client";

import { RotateCw } from "lucide-react";

import { reactivateExpiredListings } from "@/lib/actions/catalog";
import { useFormAction } from "@/lib/use-form-action";

/**
 * Brings every expired listing back in one go and says which ones could not.
 * It stays mounted when nothing expired is left, so the result of the run
 * that emptied the list is still there to read after the page refreshes.
 */
export function ReactivateExpiredButton({ shopId, count }: { shopId: number; count: number }) {
  const action = reactivateExpiredListings.bind(null, shopId);
  const [state, formAction, pending] = useFormAction(action);
  if (count < 1 && !state.message) return null;

  return (
    <form action={formAction} className="space-y-2">
      {count > 0 ? <button
        className="tap inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-brand hover:border-brand disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        <RotateCw aria-hidden="true" className="size-4" />
        {pending ? "Reactivando…" : `Reactivar todos (${count})`}
      </button> : null}
      {state.message ? (
        <p className={`text-sm ${state.status === "error" ? "text-sale" : "text-success"}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
