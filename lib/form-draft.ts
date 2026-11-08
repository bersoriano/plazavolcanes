"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps what someone has typed, in their own browser, until the form succeeds.
 *
 * A form that dies — a crashed tab, a closed browser, a phone that ran out of
 * memory part way through an upload — should not cost somebody a long product
 * description. Files are deliberately not kept: a File cannot be stored, and
 * re-picking a photo is a smaller loss than retyping everything around it.
 */
const SKIPPED_TYPES = new Set(["file", "password", "submit", "button", "hidden"]);

type Draft = Record<string, string>;

function readDraft(key: string): Draft | null {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as Draft) : null;
  } catch {
    // Private windows and blocked site data both throw rather than return null.
    return null;
  }
}

function fieldsOf(form: HTMLFormElement) {
  return Array.from(form.elements).filter(
    (element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
      (element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement) &&
      Boolean(element.name) &&
      !SKIPPED_TYPES.has((element as HTMLInputElement).type),
  );
}

/** For a form that finished somewhere else, such as an action that redirected. */
export function forgetFormDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing was stored, so nothing needs clearing.
  }
}

export function useFormDraft(key: string, restored?: () => void) {
  const formRef = useRef<HTMLFormElement>(null);
  const restoredOnce = useRef(false);

  const clear = useCallback(() => forgetFormDraft(key), [key]);

  const save = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    const draft: Draft = {};
    for (const field of fieldsOf(form)) {
      if (field instanceof HTMLInputElement && (field.type === "radio" || field.type === "checkbox")) {
        if (field.checked) draft[field.name] = field.value;
        continue;
      }
      // An editor may opt in to restoring changes to a nonempty field. Key its
      // draft by the original value so a later server edit takes precedence.
      const baseline = field.dataset.draftBaseline;
      if (baseline !== undefined) {
        if (field.value !== baseline) draft[`${field.name}:${baseline}`] = field.value;
      } else if (field.value) {
        draft[field.name] = field.value;
      }
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // A full or unavailable store must not interrupt someone's typing.
    }
  }, [key]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || restoredOnce.current) return;
    restoredOnce.current = true;

    const draft = readDraft(key);
    if (!draft) return;

    let filled = false;
    for (const field of fieldsOf(form)) {
      if (field instanceof HTMLInputElement && (field.type === "radio" || field.type === "checkbox")) {
        continue;
      }
      const baseline = field.dataset.draftBaseline;
      const value = draft[baseline === undefined ? field.name : `${field.name}:${baseline}`];
      if (value === undefined || field.value !== (baseline ?? "")) continue;

      field.value = value;
      filled = true;
    }

    if (filled) restored?.();
  }, [key, restored]);

  return { clear, formRef, save };
}
