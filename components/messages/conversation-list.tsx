import Link from "next/link";

import { formatDate } from "@/lib/format";
import type { ConversationSummary } from "@/lib/queries/messages";

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
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <strong className="truncate font-semibold">{conversation.counterpart_label}</strong>
                {conversation.type === "order" && conversation.order_id ? (
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                    Pedido #{conversation.order_id}
                  </span>
                ) : null}
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
          </Link>
        </li>
      ))}
    </ul>
  );
}
