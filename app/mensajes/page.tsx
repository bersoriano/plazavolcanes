import { MessageCircle } from "lucide-react";

/**
 * Beside the list while no conversation is open. Below `lg` the list is the
 * whole screen and the inbox does not show this at all.
 */
export default function MessagesPage() {
  return (
    <div className="grid flex-1 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-brand">
          <MessageCircle aria-hidden="true" className="size-7" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em]">
          Elige una conversación
        </h2>
        <p className="mt-2 leading-7 text-muted">Se abrirá aquí, junto a tu lista.</p>
      </div>
    </div>
  );
}
