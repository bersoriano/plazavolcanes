"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

const LABEL = "Mensaje a la tienda";
const STYLE =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-brand transition-colors hover:border-brand";

function OpenButton() {
  const { pending } = useFormStatus();

  return (
    <button className={STYLE} disabled={pending} type="submit">
      <MessageCircle aria-hidden="true" className="size-4" />
      {pending ? "Abriendo…" : LABEL}
    </button>
  );
}

export function StartConversationButton({
  action,
  isOwnShop,
  shopId,
  signedIn,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  isOwnShop: boolean;
  shopId: number;
  signedIn: boolean;
}) {
  const [state, formAction] = useFormAction(action);

  // A shop owner messaging their own shop is refused by the database anyway.
  // Not offering it is kinder than explaining it.
  if (isOwnShop) return null;

  if (!signedIn) {
    return (
      <Link className={STYLE} href="/ingresar?continuar=/mensajes">
        <MessageCircle aria-hidden="true" className="size-4" />
        {LABEL}
      </Link>
    );
  }

  return (
    <form action={formAction}>
      <input name="shop_id" type="hidden" value={shopId} />
      <OpenButton />
      {state.message ? (
        <p className="mt-2 text-sm text-sale" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
