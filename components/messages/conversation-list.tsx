import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/format";
import type { ConversationProduct, ConversationSummary } from "@/lib/queries/messages";

/**
 * The listing a thread is about. It is a thumbnail plus words, never a thumbnail
 * alone: the row has to say what it concerns to somebody who cannot see it.
 */
function ProductThumbnail({ product }: { product: ConversationProduct }) {
  return (
    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#eee8e1]">
      {product.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img alt={product.name} className="size-full object-cover" src={product.image_url} />
      ) : (
        <ImageIcon aria-hidden="true" className="size-6 text-brand/30" />
      )}
    </span>
  );
}

function ContextLine({ conversation }: { conversation: ConversationSummary }) {
  if (conversation.type === "order" && conversation.order_id) {
    return (
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
        Pedido #{conversation.order_id}
      </span>
    );
  }

  if (!conversation.product) {
    return (
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
        Consulta general
      </span>
    );
  }

  return null;
}

export function ConversationList({
  basePath,
  conversations,
}: {
  basePath: string;
  conversations: ConversationSummary[];
}) {
  if (!conversations.length) {
    return <p className="mt-7 text-muted">No tienes conversaciones todavía.</p>;
  }

  return (
    <ul className="mt-7 divide-y divide-line overflow-hidden rounded-[2rem] border border-line bg-surface">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <Link
            className="flex items-start gap-4 p-5 transition-colors hover:bg-background"
            href={`${basePath}/${conversation.id}`}
          >
            {conversation.product ? <ProductThumbnail product={conversation.product} /> : null}

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <strong className="truncate font-semibold">{conversation.counterpart_label}</strong>
                <ContextLine conversation={conversation} />
              </span>

              {conversation.product ? (
                <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="min-w-0 truncate text-sm font-semibold text-ink">
                    {conversation.product.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-brand">
                    {formatCurrency(conversation.product.price, conversation.product.currency_code)}
                  </span>
                  {conversation.product.is_available ? null : (
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-sale">
                      Ya no disponible
                    </span>
                  )}
                </span>
              ) : null}

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
          </Link>
        </li>
      ))}
    </ul>
  );
}
