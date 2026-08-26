"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

const STYLE =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-brand transition-colors hover:border-brand";

function OpenButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className={STYLE} disabled={pending} type="submit">
      <MessageCircle aria-hidden="true" className="size-4" />
      {pending ? "Abriendo…" : label}
    </button>
  );
}

export function StartConversationButton({
  action,
  isOwnShop,
  label = "Mensaje a la tienda",
  returnTo,
  signedIn,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  isOwnShop: boolean;
  label?: string;
  /** Where signing in should land, so the product or shop being asked about survives it. */
  returnTo: string;
  signedIn: boolean;
}) {
  const [state, formAction] = useFormAction(action);

  // A shop owner messaging their own shop is refused by the database anyway.
  // Not offering it is kinder than explaining it.
  if (isOwnShop) return null;

  if (!signedIn) {
    // Sending everyone to the inbox lost the page they were asking about, and with
    // it the product the thread was going to be about.
    return (
      <Link className={STYLE} href={`/ingresar?continuar=${encodeURIComponent(returnTo)}`}>
        <MessageCircle aria-hidden="true" className="size-4" />
        {label}
      </Link>
    );
  }

  // The shop and the product are bound into the action on the server. Nothing the
  // form carries decides which conversation this opens.
  return (
    <form action={formAction}>
      <OpenButton label={label} />
      {state.message ? (
        <p className="mt-2 text-sm text-sale" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
