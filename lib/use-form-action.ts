"use client";

import { useActionState } from "react";

import { formValues, initialActionState, type ActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * useActionState, plus the values the person had typed.
 *
 * React 19 resets a form once its action settles, so a rejected submit would
 * otherwise wipe everything the person entered. Wrapping on the client keeps the
 * values here rather than sending them back from the server.
 */
export function useFormAction(action: FormAction) {
  return useActionState(async (state: ActionState, formData: FormData) => {
    const result = await action(state, formData);

    return result.status === "error"
      ? { ...result, values: formValues(formData) }
      : result;
  }, initialActionState);
}
