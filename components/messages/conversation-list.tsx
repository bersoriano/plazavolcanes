import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/format";
import type { ConversationProduct, ConversationSummary } from "@/lib/queries/messages";

/** Lines up the message block under the text column of the context band above it. */
const MESSAGE_INDENT = "pl-[3.75rem] sm:pl-[4.5rem]";
const ORDER_LABEL = "text-xs font-semibold uppercase tracking-[0.14em] text-brand";

/**
 * The listing a thread is about. It is a thumbnail plus words, never a thumbnail
 * alone: the row has to say what it concerns to somebody who cannot see it.
 */
function ProductThumbnail({ product }: { product: ConversationProduct }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#eee8e1] sm:size-14">
      {product.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img alt={product.name} className="size-full object-cover" src={product.image_url} />
      ) : (
        <ImageIcon aria-hidden="true" className="size-6 text-brand/30" />
      )}
    </span>
  );
}

/**
 * What the thread is about, read before the conversation itself. It is a band, not
 * a card: spacing and type set it apart from the message below, so the row stays
 * one target with one frame.
 */
function ThreadContextBand({ conversation }: { conversation: ConversationSummary }) {
  const orderLabel =
    conversation.type === "order" && conversation.order_id
      ? `Pedido #${conversation.order_id}`
      : null;

  if (!conversation.product) {
    return orderLabel ? <span className={`block ${ORDER_LABEL}`}>{orderLabel}</span> : null;
  }

  return (
    <span className="block">
      {orderLabel ? <span className={`mb-1.5 block ${ORDER_LABEL}`}>{orderLabel}</span> : null}

      <span className="flex items-center gap-3 sm:gap-4">
        <ProductThumbnail product={conversation.product} />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="min-w-0 truncate text-[0.8125rem] font-semibold leading-5 text-ink">
              {conversation.product.name}
            </span>
            <span className="shrink-0 text-[0.8125rem] font-semibold leading-5 text-brand">
              {formatCurrency(conversation.product.price, conversation.product.currency_code)}
            </span>
          </span>
          {conversation.product.is_available ? null : (
            <span className="mt-0.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-sale">
              Ya no disponible
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

export function ConversationList({
  basePath,
  conversations,
  emptyMessage = "No tienes conversaciones todavía.",
}: {
  basePath: string;
  conversations: ConversationSummary[];
  emptyMessage?: string;
}) {
  if (!conversations.length) {
    return (
      <p className="mt-6 rounded-[2rem] border border-dashed border-line bg-surface/60 px-6 py-8 text-sm leading-6 text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="mt-7 divide-y divide-line overflow-hidden rounded-[2rem] border border-line bg-surface">
      {conversations.map((conversation) => {
        const hasProduct = Boolean(conversation.product);
        const hasOrder = conversation.type === "order" && Boolean(conversation.order_id);
        const hasContext = hasProduct || hasOrder;

        return (
          <li key={conversation.id}>
            <Link
              className="block p-4 transition-colors hover:bg-background sm:p-5"
              href={`${basePath}/${conversation.id}`}
            >
              <ThreadContextBand conversation={conversation} />

              <span
                className={`flex items-start gap-4 ${
                  hasContext ? `mt-2.5 ${hasProduct ? MESSAGE_INDENT : ""}` : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <strong className="truncate font-semibold">
                      {conversation.counterpart_label}
                    </strong>
                    {hasContext ? null : (
                      <span className={`shrink-0 ${ORDER_LABEL}`}>Consulta general</span>
                    )}
                  </span>

                  <span className="mt-1 block truncate text-sm text-muted">
                    {conversation.last_message?.body ?? "Sin mensajes todavía"}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-2">
                  {conversation.last_message ? (
                    <span className="text-xs text-muted">
                      {formatDate(conversation.last_message.created_at)}
                    </span>
                  ) : null}
                  {conversation.unread_count > 0 ? (
                    <span
                      aria-label={`${conversation.unread_count} mensajes sin leer`}
                      className="grid min-w-6 place-items-center rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white"
                    >
                      {conversation.unread_count}
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
