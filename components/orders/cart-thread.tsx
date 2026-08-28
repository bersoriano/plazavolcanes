"use client";

import { useState, type KeyboardEvent } from "react";

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
  const hasTabs = threads.length > 1;

  if (!active) return null;

  function selectTab(index: number) {
    const next = threads[index];
    if (!next) return;
    setActiveId(next.productId);
    document.getElementById(`cart-thread-tab-${next.productId}`)?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % threads.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + threads.length) % threads.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = threads.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    selectTab(nextIndex);
  }

  const activeContent = active.conversationId !== null ? (
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
  );

  return (
    <div>
      {hasTabs ? (
        <div
          aria-label="Productos del carrito"
          aria-orientation="horizontal"
          className="flex flex-wrap gap-2 border-b border-line pb-3"
          role="tablist"
        >
          {threads.map((thread, index) => (
            <button
              aria-controls={`cart-thread-panel-${thread.productId}`}
              aria-selected={thread.productId === active.productId}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                thread.productId === active.productId
                  ? "bg-brand text-white"
                  : "border border-line text-muted"
              }`}
              id={`cart-thread-tab-${thread.productId}`}
              key={thread.productId}
              onClick={() => setActiveId(thread.productId)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={thread.productId === active.productId ? 0 : -1}
              type="button"
            >
              {thread.productName}
            </button>
          ))}
        </div>
      ) : null}

      {hasTabs ? (
        threads.map((thread) => (
          <div
            aria-labelledby={`cart-thread-tab-${thread.productId}`}
            className="mt-4"
            hidden={thread.productId !== active.productId}
            id={`cart-thread-panel-${thread.productId}`}
            key={thread.productId}
            role="tabpanel"
          >
            {thread.productId === active.productId ? activeContent : null}
          </div>
        ))
      ) : (
        <div className="mt-4">{activeContent}</div>
      )}
    </div>
  );
}
