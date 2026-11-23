/**
 * Google Analytics form events (form_start, form_submit, form_error and the
 * confirmed outcome). Only the form's name is sent, never a field value.
 */
import { useRef } from "react";
// Next.js has no public helper for this. A server action that calls
// redirect() rejects its client promise with this error (see
// next/dist/client/components/router-reducer/reducers/server-action-reducer).
import { isRedirectError } from "next/dist/client/components/redirect-error";

import type { ActionState } from "@/lib/action-state";
import { track } from "@/lib/analytics.client";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** generate_lead for a message the plaza received; sign_up for an account that was opened. */
type Outcome = "generate_lead" | "sign_up";

/**
 * Wraps a server action with the form events. The outcome is reported only
 * once the server confirmed it: a success state, or a redirect, which is how
 * signUp ends when the new account already has a session. A click or a refused
 * submit is never a conversion. The action's result and errors pass through
 * unchanged, so redirects still navigate.
 */
export function trackFormAction(action: FormAction, form_name: string, outcome: Outcome): FormAction {
  const confirmed = () => track(outcome, outcome === "sign_up" ? { method: "email", form_name } : { form_name });

  return async (state, formData) => {
    track("form_submit", { form_name });
    let result: ActionState;
    try {
      result = await action(state, formData);
    } catch (error) {
      if (isRedirectError(error)) confirmed();
      else track("form_error", { form_name, error_type: "network" });
      throw error;
    }
    if (result.status === "success") confirmed();
    else track("form_error", { form_name, error_type: result.errors ? "validation" : "server" });
    return result;
  };
}

/** An onFocus handler for the <form>: form_start on the first field the person enters. */
export function useFormStart(form_name: string) {
  const started = useRef(false);
  return () => {
    if (started.current) return;
    started.current = true;
    track("form_start", { form_name });
  };
}
