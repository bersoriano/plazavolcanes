"use client";

import { useState } from "react";

import type { ActionState } from "@/lib/action-state";
import type { CartThread } from "@/lib/queries/checkout.server";
import { MessageThread } from "@/components/messages/message-thread";
import { StartConversationButton } from "@/components/messages/start-conversation-button";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export type CartThreadWithActions =
  | (Omit<CartThread, "conversationId"> & {
      conversationId: number;
      sendAction: Action;
      startAction: null;
    })
  | (Omit<CartThread, "conversationId"> & {
      conversationId: null;
      sendAction: null;
      startAction: Action;
    });

/**
 * The conversation about what is being bought, beside what is being bought.
 *
 * A cart holds several products from one shop and each keeps its own thread, so
 * the tabs are the cart. A product with no thread yet shows the button that opens
 * one — rendering must never open it, because a render is a GET.
 */
export function CartThreads({
  currentUserId,
  threads,
}: {
  currentUserId: string;
  threads: CartThreadWithActions[];
}) {
  const [activeId, setActiveId] = useState(threads[0]?.productId ?? null);
  const active = threads.find((thread) => thread.productId === activeId) ?? threads[0];

  if (!active) return null;

  return (
    <div>
      {threads.length > 1 ? (
        <div className="flex flex-wrap gap-2 border-b border-line pb-3" role="tablist">
          {threads.map((thread) => (
            <button
              aria-selected={thread.productId === active.productId}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                thread.productId === active.productId
                  ? "bg-brand text-white"
                  : "border border-line text-muted"
              }`}
              key={thread.productId}
              onClick={() => setActiveId(thread.productId)}
              role="tab"
              type="button"
            >
              {thread.productName}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {active.conversationId !== null ? (
          <MessageThread
            action={active.sendAction}
            conversationId={active.conversationId}
            currentUserId={currentUserId}
            key={active.conversationId}
            messages={active.messages}
          />
        ) : (
          <div className="rounded-2xl border border-line p-5">
            <p className="text-sm leading-6 text-muted">
              Pregunta al vendedor antes de confirmar: entrega, estado del producto, lo que necesites.
            </p>
            <div className="mt-4">
              <StartConversationButton
                action={active.startAction}
                isOwnShop={false}
                label="Preguntar sobre este producto"
                returnTo="/"
                signedIn
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
